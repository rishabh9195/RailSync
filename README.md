# 🚆 RailSync

**Machine-learning powered train ETA prediction and railway operations dashboard.**

RailSync pairs a Python backend that serves a trained ETA (Estimated Time of Arrival) model with a multi-page web dashboard for passengers and railway operators. It brings train schedules, live-style alerts, events, analytics, and what-if simulations into one place.

---

## ✨ Features

- **ETA prediction**: a trained ML model predicts train arrival times from historical data.
- **Passenger view**: check train status and expected arrival times.
- **Operator view**: monitor trains and manage operations from a control-room style page.
- **Schedule**: browse train timetables.
- **Alerts & events**: surface delays, disruptions, and notable events.
- **Analytics**: visualise performance and delay patterns.
- **Simulation**: experiment with scenarios and see their effect on arrivals.
- **Train details**: a dedicated page for individual train information.

---

## 🛠️ Tech Stack

| Layer     | Technology                              |
|-----------|-----------------------------------------|
| Frontend  | HTML, CSS, JavaScript                   |
| Backend   | Python (`main.py`)                      |
| ML Model  | Trained ETA model (see `model/`)        |
| Data      | CSV dataset (10,000 records)            |

> Update this table with your exact framework and libraries (e.g. FastAPI/Flask, scikit-learn/XGBoost, Chart.js).

---

## 📁 Project Structure

```
new/
├── backend/
│   ├── data/                 # Data files used by the backend
│   ├── model/                # Model artifacts / related code
│   └── main.py               # Backend entry point
├── frontend/
│   ├── css/                  # Stylesheets
│   ├── js/                   # Client-side scripts
│   ├── index.html            # Landing page
│   ├── passenger.html        # Passenger dashboard
│   ├── operator.html         # Operator dashboard
│   ├── train.html            # Train details
│   ├── schedule.html         # Timetables
│   ├── alerts.html           # Alerts
│   ├── events.html           # Events
│   ├── analytics.html        # Analytics
│   └── simulation.html       # Scenario simulation
├── train_eta_initial_dataset_10000.csv   # Training dataset
├── train_eta_best_model_*                # Best trained ETA model
└── .gitignore
```

---

## 🚀 Getting Started

### Prerequisites

- Python 3.9+
- A modern web browser
- Git

### 1. Clone the repository

```bash
git clone https://github.com/rishabh9195/RailSync.git
cd RailSync
```

### 2. Set up the backend

```bash
cd backend

# Create and activate a virtual environment
python -m venv .venv

# Windows
.venv\Scripts\activate
# macOS / Linux
source .venv/bin/activate

# Install dependencies
pip install -r requirements.txt
```

> If there is no `requirements.txt` yet, generate one from your working environment with `pip freeze > requirements.txt`.

### 3. Run the backend

```bash
python main.py
```

> If the backend uses FastAPI, run `uvicorn main:app --reload` instead.

### 4. Run the frontend

In a new terminal:

```bash
cd frontend
python -m http.server 5500
```

Then open **http://localhost:5500** in your browser.

---

## 📊 Dataset & Model

- **Dataset:** `train_eta_initial_dataset_10000.csv` contains 10,000 records used to train and evaluate the ETA model.
- **Model:** the best-performing model is saved alongside the dataset and loaded by the backend to serve predictions.

Add details here about the input features, target variable, algorithm used, and evaluation metrics (e.g. MAE / RMSE).

---

## 🗺️ Roadmap

- [ ] Integrate live train data feeds
- [ ] Improve model accuracy with more features (weather, congestion, track conditions)
- [ ] User authentication for operator pages
- [ ] Deployment (Docker / cloud hosting)

---

## 🤝 Contributing

Contributions are welcome!

1. Fork the repository
2. Create a feature branch: `git checkout -b feature/your-feature`
3. Commit your changes: `git commit -m "Add your feature"`
4. Push to the branch: `git push origin feature/your-feature`
5. Open a Pull Request

---


## 👤 Author

**Rishabh** — [@rishabh9195](https://github.com/rishabh9195)
