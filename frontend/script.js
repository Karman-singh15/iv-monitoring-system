let tempChart;

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

// Load data on page load and every 2 seconds
loadData();
setInterval(loadData, 2000);