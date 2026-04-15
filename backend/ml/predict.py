import sys
import joblib

# load model
model = joblib.load("backend/ml/model.pkl")

# get inputs: r1, r2, r3, r4, r5, total_drops
inputs = list(map(float, sys.argv[1:7]))

if len(inputs) != 6:
    print("Error: Expected 6 inputs (r1-r5: rate history, total_drops)")
    sys.exit(1)

# predict
pred = model.predict([inputs])
remaining_volume = pred[0]

# ensure reasonable bounds (0 to 500 ml)
remaining_volume = max(0, min(500, remaining_volume))

print(f"{remaining_volume:.2f}")