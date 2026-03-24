import joblib

# load model
model = joblib.load("backend/ml/model.pkl")

# sample input: [time, drops_per_sec, total_drops]
sample = [[120, 2.0, 240]]

prediction = model.predict(sample)

print("Predicted remaining volume:", prediction[0])