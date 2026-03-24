import sys
import joblib

# load model
model = joblib.load("backend/ml/model.pkl")

# get inputs
time = float(sys.argv[1])
drops_per_sec = float(sys.argv[2])
total_drops = float(sys.argv[3])

# predict
pred = model.predict([[time, drops_per_sec, total_drops]])

print(pred[0])