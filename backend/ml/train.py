import numpy as np
import pandas as pd
from sklearn.linear_model import LinearRegression
import joblib
from collections import deque

# simulate data with rate history
data = []
total_volume = 500  # ml
drop_volume = 0.05
total_drops = 0
rate_buffer = deque(maxlen=5)

for t in range(1, 1000):
    drops_per_sec = np.random.uniform(1.5, 2.5)
    drops = drops_per_sec
    
    total_drops += drops
    volume_used = total_drops * drop_volume
    remaining = total_volume - volume_used
    
    if remaining <= 0:
        break

    # Build rate history
    rate_buffer.append(drops_per_sec)
    
    # Only start collecting data once we have 5 rates
    if len(rate_buffer) == 5:
        row = list(rate_buffer) + [total_drops, remaining]
        data.append(row)

df = pd.DataFrame(data, columns=[
    "r1", "r2", "r3", "r4", "r5", "total_drops", "remaining_volume"
])

# save dataset
df.to_csv("backend/ml/iv_data.csv", index=False)

# train model with rate history features
X = df[["r1", "r2", "r3", "r4", "r5", "total_drops"]]
y = df["remaining_volume"]

model = LinearRegression()
model.fit(X, y)

# save model
joblib.dump(model, "backend/ml/model.pkl")

print("✅ Model trained with rate history!")
print(f"📊 Dataset size: {len(df)} samples")
print(f"🎯 Model features: rate history (r1-r5) + total_drops")
print(f"🔮 Model coefficients: {dict(zip(X.columns, model.coef_))}")