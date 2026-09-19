from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pathlib import Path
from pydantic import BaseModel
from typing import Optional, Union
import datetime
import joblib
import math
import os
import pandas as pd
import re
import secrets

BASE_DIR = Path(__file__).resolve().parent

app = FastAPI()
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Load trained model (unchanged artifact)
model = joblib.load(
    BASE_DIR / "model" / "train_eta_best_model_withcorrespondece.pkl"
)

# Load dataset (unchanged artifact, used as baseline feature source)
df = pd.read_csv(
    BASE_DIR / "data" / "train_eta_initial_dataset_10000.csv"
)


# ============================================================
# Operator authentication (single configuration location)
# Prototype/demo: credentials are verified here on the backend
# via POST /auth/operator/verify. The frontend never stores the
# username or password — it only keeps a sessionStorage flag
# after the backend confirms success. Override with env vars in
# production. To later use real auth, replace verify_operator()
# internals (e.g. check hashed credentials / issue a token).
# ============================================================
OPERATOR_USERNAME = os.environ.get("OPERATOR_USERNAME", "operator")
OPERATOR_PASSWORD = os.environ.get("OPERATOR_PASSWORD", "operator123")


# Operational state (prototype in-memory store)
# Key: (train_no, current_station, next_station)
# Values entered via Operator Mode, applied by /predict.
# ============================================================

OPERATIONS = {}


# Dataset congestion_score is a 0-1 float (observed range
# 0.004-0.92, mean ~0.29). Operator Low/Medium/High labels
# map inside that range so the model never extrapolates.
CONGESTION_MAP = {
    "low": 0.15,
    "medium": 0.30,
    "high": 0.65,
}


def section_exists(train_no, current_station, next_station):
    return not df[
        (df["train_no"] == train_no) &
        (df["current_station"] == current_station) &
        (df["next_station"] == next_station)
    ].empty


def slug(text):
    return re.sub(r"[^a-z0-9]+", "", str(text).lower())


def now_iso():
    return datetime.datetime.now(
        datetime.timezone.utc
    ).isoformat()


def derive_severity(delay_min, congestion_label):
    # Simple consistent scale reusing the Low/Medium/High
    # vocabulary already used across the project.
    if delay_min >= 15 or congestion_label == "High":
        return "high"
    if delay_min >= 8 or congestion_label == "Medium":
        return "medium"
    return "low"


def build_alert_message(train_no, current_station, event_type, delay_min):
    kind = (event_type or "").strip().lower()
    if "signal" in kind:
        return (
            f"Train {train_no} may be delayed near "
            f"{current_station} due to a signalling issue."
        )
    if "heavy congestion" in kind:
        return (
            f"Heavy congestion near {current_station} may "
            f"affect Train {train_no}'s running time."
        )
    if "congestion" in kind:
        return (
            f"Train {train_no} may experience additional "
            f"delay near {current_station} due to "
            f"{event_type.strip().lower()}."
        )
    if delay_min > 0:
        return (
            f"Train {train_no} is currently running "
            f"approximately {int(round(delay_min))} minutes "
            f"late near {current_station}."
        )
    return (
        f"Train {train_no} is currently running near "
        f"{current_station} with no significant delay reported."
    )


def to_alert(train_no, current_station, next_station, op):
    return {
        "event_id": op["event_id"],
        "train_no": train_no,
        "current_station": current_station,
        "next_station": next_station,
        "event_type": op["event_type"],
        "delay_min": op["current_delay_min"],
        "congestion": op["congestion_label"],
        "congestion_score": op["congestion_score"],
        "severity": op["severity"],
        "message": op["message"],
        "operator_note": op["operator_note"],
        "updated_at": op["updated_at"],
        "active": True
    }


def resolve_congestion(congestion):
    # Accepts "Low"/"Medium"/"High" (any case) or a 0-1 number.
    if isinstance(congestion, str):
        key = congestion.strip().lower()
        if key not in CONGESTION_MAP:
            raise HTTPException(
                status_code=422,
                detail="congestion must be Low, Medium, High or a number 0-1"
            )
        return CONGESTION_MAP[key], key.capitalize()
    try:
        score = float(congestion)
    except (TypeError, ValueError):
        raise HTTPException(
            status_code=422,
            detail="congestion must be Low, Medium, High or a number 0-1"
        )
    if not math.isfinite(score) or score < 0 or score > 1:
        raise HTTPException(
            status_code=422,
            detail="congestion score must be between 0 and 1"
        )
    label = (
        "Low" if score < 0.225
        else "Medium" if score < 0.475
        else "High"
    )
    return score, label


# Data coming from frontend
class TrainRequest(BaseModel):
    train_no: int
    current_station: str
    next_station: str


class OperationUpdate(BaseModel):
    train_no: int
    current_station: str
    next_station: str
    current_delay_min: float
    congestion: Union[str, float]
    event_type: Optional[str] = ""
    operator_note: Optional[str] = ""


class OperationClear(BaseModel):
    train_no: int
    current_station: Optional[str] = None
    next_station: Optional[str] = None


class OperatorLogin(BaseModel):
    username: str
    password: str


def verify_operator(username: str, password: str) -> bool:
    # Constant-time comparison for both credentials to avoid
    # timing leaks. Both are always compared (no short-circuit)
    # so a wrong username reveals nothing about the password.
    user_ok = secrets.compare_digest(
        str(username or ""),
        str(OPERATOR_USERNAME),
    )
    pass_ok = secrets.compare_digest(
        str(password or ""),
        str(OPERATOR_PASSWORD),
    )
    return user_ok and pass_ok


@app.get("/")
def home():
    return {
        "message": "RailSync API is running"
    }


@app.post("/auth/operator/verify")
def verify_operator_login(data: OperatorLogin):
    if verify_operator(data.username, data.password):
        return {"success": True}
    raise HTTPException(
        status_code=401,
        detail="Invalid username or password",
    )


@app.post("/predict")
def predict(data: TrainRequest):

    # Find the exact train + route
    result = df[
        (df["train_no"] == data.train_no) &
        (df["current_station"] == data.current_station) &
        (df["next_station"] == data.next_station)
    ]

    # If route doesn't exist
    if result.empty:
        raise HTTPException(
            status_code=404,
            detail="Train route not found"
        )

    # Take the first matching row as baseline features
    row = result.iloc[0]

    # Operator overrides for this exact train + section, if any.
    # Falls back to baseline dataset values otherwise.
    op = OPERATIONS.get(
        (data.train_no, data.current_station, data.next_station)
    )

    if op:
        delay_used = float(op["current_delay_min"])
        congestion_used = float(op["congestion_score"])
    else:
        delay_used = float(row["current_delay_min"])
        congestion_used = float(row["congestion_score"])

    # Prepare data for ML model (same features, same pipeline)
    input_data = pd.DataFrame([{
        "train_no": row["train_no"],
        "train_type": row["train_type"],
        "current_station": row["current_station"],
        "next_station": row["next_station"],
        "distance_remaining_km": row["distance_remaining_km"],
        "current_speed_kmph": row["current_speed_kmph"],
        "current_delay_min": delay_used,
        "historical_avg_delay_min": row["historical_avg_delay_min"],
        "congestion_score": congestion_used,
        "weather": row["weather"],
        "hour": row["hour"],
        "day_of_week": row["day_of_week"]
    }])

    # Make prediction
    prediction = model.predict(input_data)

    return {
        "train_no": data.train_no,
        "current_station": data.current_station,
        "next_station": data.next_station,
        "predicted_remaining_time_min": round(
            float(prediction[0]), 2
        ),
        "operational_override_applied": op is not None,
        "current_delay_min": delay_used,
        "congestion_score": round(congestion_used, 4),
        "event_type": op["event_type"] if op else "",
        "operator_note": op["operator_note"] if op else ""
    }


@app.post("/operations/update")
def update_operation(data: OperationUpdate):

    # Train must exist
    if data.train_no not in df["train_no"].unique().tolist():
        raise HTTPException(
            status_code=404,
            detail="Train not found"
        )

    # Section must be a real route pair for that train
    if not section_exists(
        data.train_no, data.current_station, data.next_station
    ):
        raise HTTPException(
            status_code=404,
            detail="Invalid section for this train"
        )

    # Delay must be numeric and sensible
    try:
        delay = float(data.current_delay_min)
    except (TypeError, ValueError):
        raise HTTPException(
            status_code=422,
            detail="current_delay_min must be numeric"
        )
    if not math.isfinite(delay) or delay < -10 or delay > 120:
        raise HTTPException(
            status_code=422,
            detail="current_delay_min must be between -10 and 120"
        )

    congestion_score, congestion_label = resolve_congestion(
        data.congestion
    )

    event_type = (data.event_type or "").strip()
    operator_note = (data.operator_note or "").strip()

    # Same train + section key: repeat updates overwrite the
    # stored record, so the passenger alert is updated, never
    # duplicated.
    OPERATIONS[(
        data.train_no,
        data.current_station,
        data.next_station
    )] = {
        "event_id": (
            f"op-{data.train_no}-"
            f"{slug(data.current_station)}-"
            f"{slug(data.next_station)}"
        ),
        "current_delay_min": delay,
        "congestion_score": congestion_score,
        "congestion_label": congestion_label,
        "event_type": event_type,
        "operator_note": operator_note,
        "severity": derive_severity(delay, congestion_label),
        "message": build_alert_message(
            data.train_no,
            data.current_station,
            event_type,
            delay
        ),
        "updated_at": now_iso(),
        "active": True
    }

    stored = OPERATIONS[(
        data.train_no,
        data.current_station,
        data.next_station
    )]

    return {
        "success": True,
        "train_no": data.train_no,
        "current_station": data.current_station,
        "next_station": data.next_station,
        "current_delay_min": delay,
        "congestion_score": congestion_score,
        "congestion_label": congestion_label,
        "event_type": event_type,
        "operator_note": operator_note,
        "event_id": stored["event_id"],
        "severity": stored["severity"],
        "message": stored["message"],
        "updated_at": stored["updated_at"]
    }


@app.get("/operations/{train_no}")
def get_operations(train_no: int):

    if train_no not in df["train_no"].unique().tolist():
        raise HTTPException(
            status_code=404,
            detail="Train not found"
        )

    sections = [
        {
            "current_station": key[1],
            "next_station": key[2],
            **value
        }
        for key, value in OPERATIONS.items()
        if key[0] == train_no
    ]

    return {
        "train_no": train_no,
        "sections": sections
    }


@app.get("/alerts")
def get_alerts():
    # Active passenger alerts, derived from the same
    # operational state that feeds /predict. Newest first.
    alerts = [
        to_alert(key[0], key[1], key[2], value)
        for key, value in OPERATIONS.items()
        if value.get("active", True)
    ]
    alerts.sort(key=lambda a: a["updated_at"], reverse=True)
    return {
        "alerts": alerts
    }


@app.get("/alerts/{train_no}")
def get_alerts_for_train(train_no: int):

    if train_no not in df["train_no"].unique().tolist():
        raise HTTPException(
            status_code=404,
            detail="Train not found"
        )

    alerts = [
        to_alert(key[0], key[1], key[2], value)
        for key, value in OPERATIONS.items()
        if key[0] == train_no and value.get("active", True)
    ]
    alerts.sort(key=lambda a: a["updated_at"], reverse=True)
    return {
        "train_no": train_no,
        "alerts": alerts
    }


@app.post("/operations/clear")
def clear_operations(data: OperationClear):

    removed = 0

    if data.current_station and data.next_station:
        keys = [(
            data.train_no,
            data.current_station,
            data.next_station
        )]
    else:
        keys = [
            key for key in OPERATIONS
            if key[0] == data.train_no
        ]

    for key in keys:
        if key in OPERATIONS:
            del OPERATIONS[key]
            removed += 1

    return {
        "success": True,
        "train_no": data.train_no,
        "cleared": removed
    }
