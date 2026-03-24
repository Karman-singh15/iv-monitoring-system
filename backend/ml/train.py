import numpy as np
import pandas as pd
from sklearn.linear_model import LinearRegression
import joblib

# simulate data
data = []
total_volume = 500  # ml
drop_volume = 0.05
total_drops = 0

for t in range(1, 1000):
    drops_per_sec = np.random.uniform(1.5, 2.5)
    drops = drops_per_sec
    
    total_drops += drops
    volume_used = total_drops * drop_volume
    remaining = total_volume - volume_used
    
    if remaining <= 0:
        break

    data.append([t, drops_per_sec, total_drops, remaining])

df = pd.DataFrame(data, columns=[
    "time", "drops_per_sec", "total_drops", "remaining_volume"
])

# save dataset
df.to_csv("backend/ml/iv_data.csv", index=False)

# train model
X = df[["time", "drops_per_sec", "total_drops"]]
y = df["remaining_volume"]

model = LinearRegression()
model.fit(X, y)

# save model
joblib.dump(model, "backend/ml/model.pkl")

print("✅ Model trained and saved!")