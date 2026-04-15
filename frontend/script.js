let tempChart;
let rateChart;

async function loadData() {
    try {
        const res = await fetch("http://localhost:5000/data");
        const data = await res.json();

        if (data.length > 0) {
            // Update current temperature
            document.getElementById("temp").innerText = data[0].temperature + " °C";

            // Prepare data for chart
            const labels = data.reverse().map(d => new Date(d.time).toLocaleTimeString());
            const temps = data.map(d => d.temperature);

            // Update chart
            updateChart(labels, temps);
        }
    } catch (error) {
        console.error("Error loading data:", error);
        document.getElementById("temp").innerText = "Error loading data";
    }
}

function updateChart(labels, data) {
    if (!tempChart) {
        const ctx = document.getElementById('tempChart').getContext('2d');
        tempChart = new Chart(ctx, {
            type: 'line',
            data: {
                labels: labels,
                datasets: [{
                    label: 'Temperature (°C)',
                    data: data,
                    borderColor: 'rgb(255, 99, 132)',
                    backgroundColor: 'rgba(255, 99, 132, 0.2)',
                    tension: 0.1
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                scales: {
                    y: {
                        beginAtZero: false
                    }
                }
            }
        });
    } else {
        tempChart.data.labels = labels;
        tempChart.data.datasets[0].data = data;
        tempChart.update();
    }
}

// fetch flow / drop status with rate history and anomalies
async function loadStatus() {
    try {
        const res = await fetch("http://localhost:5000/status");
        const status = await res.json();
        const flowEl = document.getElementById("flow");
        const rateEl = document.getElementById("rateHistory");
        const anomalyEl = document.getElementById("anomaly");

        // Flow status
        if (status.drop) {
            flowEl.innerText = status.drop;
        } else if (status.flow) {
            flowEl.innerText = status.flow;
        } else {
            flowEl.innerText = "Unknown";
        }

        // Rate history
        if(status.rateHistory && status.rateHistory.length > 0) {
            const ratesFormatted = status.rateHistory.map(r => r.toFixed(2)).join(" → ");
            rateEl.innerText = `Rate history: [${ratesFormatted}] drops/sec`;
        } else {
            rateEl.innerText = "Collecting rate data...";
        }

        // Anomaly detection
        if(status.anomaly) {
            anomalyEl.innerText = `⚠️ ${status.anomaly.type}: ${status.anomaly.value.toFixed(2)} (avg: ${status.anomaly.avg})`;
            anomalyEl.style.color = "#ff6b6b";
            anomalyEl.style.fontWeight = "bold";
        } else {
            anomalyEl.innerText = "✅ Flow normal";
            anomalyEl.style.color = "#51cf66";
        }

        // Check if we have enough data for prediction
        if(status.rateHistory && status.rateHistory.length === 5) {
            await predictRemaining(status.rateHistory, status.totalDrops);
        }

    } catch (err) {
        console.error("Error loading status:", err);
        document.getElementById("flow").innerText = "Error";
    }
}

// Get ML prediction for remaining volume
async function predictRemaining(rateHistory, totalDrops) {
    try {
        const res = await fetch("http://localhost:5000/predict", {
            method: "POST",
            headers: {"Content-Type": "application/json"},
            body: JSON.stringify({
                totalDrops: totalDrops
            })
        });

        const prediction = await res.json();
        const remainEl = document.getElementById("remaining");

        if(prediction.remaining !== undefined) {
            remainEl.innerText = `🔮 Predicted remaining: ${prediction.remaining.toFixed(2)} ml`;
            
            // Log data for self-learning (append to server log)
            logDataPoint(rateHistory, totalDrops, prediction.remaining);
        } else {
            remainEl.innerText = "Prediction unavailable";
        }
    } catch (err) {
        console.error("Prediction error:", err);
    }
}

// Log data point for self-learning/retraining
async function logDataPoint(rateHistory, totalDrops, remaining) {
    try {
        await fetch("http://localhost:5000/log-data", {
            method: "POST",
            headers: {"Content-Type": "application/json"},
            body: JSON.stringify({
                rateHistory: rateHistory,
                totalDrops: totalDrops,
                remaining: remaining
            })
        });
    } catch (err) {
        console.error("Logging error:", err);
    }
}

async function setHR() {
    const hr = document.getElementById("hr").value;
    if (!hr) {
        alert("Please enter a heart rate value");
        return;
    }
    try {
        await fetch("http://localhost:5000/heart", {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify({ hr })
        });
        document.getElementById("hr").value = "";
        alert("Heart rate sent successfully");
    } catch (error) {
        console.error("Error sending heart rate:", error);
        alert("Error sending heart rate");
    }
}

async function setSP() {
    const sp = document.getElementById("sp").value;
    if (!sp) {
        alert("Please enter a SPO2 value");
        return;
    }
    try {
        await fetch("http://localhost:5000/spo2", {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify({ sp })
        });
        document.getElementById("sp").value = "";
        alert("SPO2 sent successfully");
    } catch (error) {
        console.error("Error sending SPO2:", error);
        alert("Error sending SPO2");
    }
}

// Load data and status on page load and every 2 seconds
loadData();
loadStatus();
setInterval(() => {
    loadData();
    loadStatus();
}, 2000);
