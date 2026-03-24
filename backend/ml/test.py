import joblib

# load model
model = joblib.load("backend/ml/model.pkl")

# sample input: [r1, r2, r3, r4, r5, total_drops]
# represents last 5 rates + total drops so far
sample = [[2.0, 2.1, 2.0, 2.2, 2.1, 240]]

prediction = model.predict(sample)
remaining = prediction[0]

# clamp to valid range
remaining = max(0, min(500, remaining))

print(f"✅ Predicted remaining volume: {remaining:.2f} ml")
print(f"   Rate history: [2.0, 2.1, 2.0, 2.2, 2.1]")
print(f"   Total drops so far: 240")