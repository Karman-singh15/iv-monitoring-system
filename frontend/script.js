async function loadData(){

 const res = await fetch("http://localhost:5000/data")

 const data = await res.json()

 if(data.length > 0){

  document.getElementById("temp").innerText =
   data[0].temperature + " °C"
 }

}

async function setHR(){

 const hr = document.getElementById("hr").value

 await fetch("http://localhost:5000/heart",{

  method:"POST",

  headers:{
   "Content-Type":"application/json"
  },

  body:JSON.stringify({hr})

 })

}

async function setSP(){

 const sp = document.getElementById("sp").value

 await fetch("http://localhost:5000/spo2",{

  method:"POST",

  headers:{
   "Content-Type":"application/json"
  },

  body:JSON.stringify({sp})

 })

}

setInterval(loadData,2000)