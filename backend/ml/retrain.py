#!/usr/bin/env python3
"""
Self-learning retraining script
Reads logged data from training_log.jsonl and retrains the model
Run periodically (daily/weekly) to improve predictions with real data
"""

import json
import numpy as np
import pandas as pd
from sklearn.linear_model import LinearRegression
import joblib
import os
from datetime import datetime

LOG_FILE = "backend/ml/training_log.jsonl"
MODEL_FILE = "backend/ml/model.pkl"
BACKUP_DIR = "backend/ml/backups"

def load_logged_data():
    """Load real data collected from the system"""
    if not os.path.exists(LOG_FILE):
        print("❌ No logged data found. Run the system first to collect data.")
        return []
    
    data = []
    with open(LOG_FILE, 'r') as f:
        for line in f:
            try:
                entry = json.loads(line)
                data.append({
                    'r1': entry['rateHistory'][0],
                    'r2': entry['rateHistory'][1],
                    'r3': entry['rateHistory'][2],
                    'r4': entry['rateHistory'][3],
                    'r5': entry['rateHistory'][4],
                    'total_drops': entry['totalDrops'],
                    'remaining': entry['remaining']
                })
            except (json.JSONDecodeError, KeyError, IndexError) as e:
                print(f"⚠️ Skipping invalid log entry: {e}")
    
    return data

def backup_model():
    """Backup current model before retraining"""
    if not os.path.exists(BACKUP_DIR):
        os.makedirs(BACKUP_DIR)
    
    if os.path.exists(MODEL_FILE):
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        backup_name = f"{BACKUP_DIR}/model_backup_{timestamp}.pkl"
        os.rename(MODEL_FILE, backup_name)
        print(f"✅ Model backed up: {backup_name}")

def retrain_model(logged_data):
    """Retrain model with real collected data"""
    
    if len(logged_data) < 10:
        print(f"⚠️ Only {len(logged_data)} samples logged. Need at least 10 for retraining.")
        return False
    
    df = pd.DataFrame(logged_data)
    
    print(f"📊 Training with {len(df)} real samples")
    print(f"   Date range: [data collection period]")
    print(f"   Rate range: {df['r1'].min():.2f} - {df['r5'].max():.2f} drops/sec")
    print(f"   Remaining range: {df['remaining'].min():.2f} - {df['remaining'].max():.2f} ml")
    
    # Train
    X = df[['r1', 'r2', 'r3', 'r4', 'r5', 'total_drops']]
    y = df['remaining']
    
    model = LinearRegression()
    model.fit(X, y)
    
    # Calculate accuracy metrics
    from sklearn.metrics import mean_squared_error, r2_score
    y_pred = model.predict(X)
    mse = mean_squared_error(y, y_pred)
    r2 = r2_score(y, y_pred)
    
    print(f"\n🎯 Model Performance:")
    print(f"   R² Score: {r2:.4f}")
    print(f"   MSE: {mse:.4f}")
    print(f"   RMSE: {np.sqrt(mse):.4f} ml")
    
    print(f"\n🧠 Learned Coefficients:")
    for feature, coef in zip(X.columns, model.coef_):
        print(f"   {feature}: {coef:.6f}")
    print(f"   Intercept: {model.intercept_:.6f}")
    
    # Save model
    joblib.dump(model, MODEL_FILE)
    print(f"\n✅ Model retrained and saved!")
    
    return True

def main():
    print("🔄 Starting self-learning retraining...")
    print(f"📝 Log file: {LOG_FILE}")
    
    # Load
    logged_data = load_logged_data()
    
    if len(logged_data) == 0:
        print("❌ No data to retrain on.")
        return
    
    # Backup old model
    backup_model()
    
    # Retrain
    success = retrain_model(logged_data)
    
    if success:
        print("\n💥 Retraining complete! Model is now more accurate with real data.")
        print("📌 Tip: Archive old training_log.jsonl after successful retraining")
    else:
        print("\n❌ Retraining failed. Model not updated.")

if __name__ == "__main__":
    main()
