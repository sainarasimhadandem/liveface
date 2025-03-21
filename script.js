// import "@mediapipe/face_mesh";
// import "@mediapipe/camera_utils";
// import "@mediapipe/drawing_utils";

// import { Camera } from "@mediapipe/camera_utils";
// import { drawConnectors, drawLandmarks } from "@mediapipe/drawing_utils";
// import { FaceMesh } from "@mediapipe/face_mesh";

if (typeof window.FaceMesh === "undefined") {
    // Fallback to a local version or show an error message to the user
    alert("Face detection functionality is unavailable. Please check your connection.");
  } 
  

let selfieBlob = null;  // Stores the captured selfie as a file.
let isFaceDetected = false;
let blinkDetected = false;
let lastBlinkTime = Date.now();
let isLightingLow = false;  // New variable for lighting condition

const videoElement = document.getElementById("camera");
const canvasElement = document.getElementById("canvas");
const canvasCtx = canvasElement.getContext("2d");
let cameraStream = null;
let image2 = null;  // Stores uploaded Image 2

const allowedTypes = ["image/jpeg", "image/png", "image/webp", "image/gif"]; // Allowed file types

document.getElementById("startCameraBtn").addEventListener("click", async function () {
    try { 

        cameraStream = await navigator.mediaDevices.getUserMedia({ 
            video: { frameRate: { ideal: 15, max: 20 } }  // Reduce frame rate
           // Why? Lower frame rate = less CPU/GPU usage = faster API response.
        });

        cameraStream = await navigator.mediaDevices.getUserMedia({ video: true });
        videoElement.srcObject = cameraStream;
        videoElement.style.display = "block";
        document.getElementById("captureSelfieBtn").style.display = "block";
        document.getElementById("selfieStatus").innerText = "Align your face and blink before capturing.";

        startFaceDetection();
    } catch (error) {
        alert("Camera access denied. Please enable camera.");
    }
});

// Initialize Mediapipe FaceMesh
const faceMesh = new FaceMesh({
    locateFile: (file) => `https://cdn.jsdelivr.net/npm/@mediapipe/face_mesh/${file}`,
});

faceMesh.setOptions({
    maxNumFaces: 2,  
    refineLandmarks: true,
    minDetectionConfidence: 0.7,  
    minTrackingConfidence: 0.7,
});

faceMesh.onResults(handleFaceDetection);

function handleFaceDetection(results) {
    canvasCtx.clearRect(0, 0, canvasElement.width, canvasElement.height);
    
    if (!results.multiFaceLandmarks || results.multiFaceLandmarks.length === 0) {
        isFaceDetected = false;
        blinkDetected = false;  
        document.getElementById("selfieStatus").innerText = "⚠️ No face detected. Align your face properly.";
        return;
    }

    if (results.multiFaceLandmarks.length > 1) {
        isFaceDetected = false;
        document.getElementById("selfieStatus").innerText = "⚠️ Multiple faces detected! Only one face allowed.";
        return;
    }

    isFaceDetected = true;
    const faceLandmarks = results.multiFaceLandmarks[0];

    // Get eye landmarks
    const leftEye = [faceLandmarks[159], faceLandmarks[145]];
    const rightEye = [faceLandmarks[386], faceLandmarks[374]];

    let leftEAR = Math.abs(leftEye[0].y - leftEye[1].y);
    let rightEAR = Math.abs(rightEye[0].y - rightEye[1].y);
    let avgEAR = (leftEAR + rightEAR) / 2;

    // Check if user blinked
    if (avgEAR < 0.02) {
        blinkDetected = true;
        lastBlinkTime = Date.now();
    }

    // **New: Check for a static face (i.e., no blinking detected for a while)**
    let timeSinceLastBlink = Date.now() - lastBlinkTime;
    
    if (timeSinceLastBlink > 2100) {  
        blinkDetected = false;
        document.getElementById("selfieStatus").innerText = "⚠️ Please blink your eyes for verification.";
    } else {
        document.getElementById("selfieStatus").innerText = "✅ Face detected & ready to capture.";
    }

    // Check lighting conditions
    checkLighting();
}

function startFaceDetection() {
    const camera = new Camera(videoElement, {
        onFrame: async () => {
            await faceMesh.send({ image: videoElement });
        },
        width: 320,
        height: 240,
    });
    camera.start();
} 


/* function startFaceDetection() {
     let lastRunTime = 0;
     const processFrame = async () => {
         if (Date.now() - lastRunTime > 500) {  // Only run every 500ms
             await faceMesh.send({ image: videoElement });
             lastRunTime = Date.now();
         }
         requestAnimationFrame(processFrame);
     };
     processFrame();
 } /Why? This prevents excessive FaceMesh execution, allowing smoother API calls.
*/



  // Function to check lighting
  function checkLighting() {
    const ctx = canvasElement.getContext("2d");
    ctx.drawImage(videoElement, 0, 0, canvasElement.width, canvasElement.height);

    const imageData = ctx.getImageData(0, 0, canvasElement.width, canvasElement.height);
    const pixels = imageData.data;
    let totalBrightness = 0;

    for (let i = 0; i < pixels.length; i += 4) {
        const r = pixels[i];
        const g = pixels[i + 1];
        const b = pixels[i + 2];
        const brightness = (r + g + b) / 3;
        totalBrightness += brightness;
    }

    const avgBrightness = totalBrightness / (canvasElement.width * canvasElement.height);

    if (avgBrightness < 50) {
        isLightingLow = false;
        document.getElementById("selfieStatus").innerText = "⚠️ Low light detected. Please improve lighting.";
    } else {
        isLightingLow = true;
    }
}

 // Capture a Selfie when face is detected, blinked, and lighting is good
document.getElementById("captureSelfieBtn").addEventListener("click", function () {
    if (!isFaceDetected) {
        alert("⚠️ No face detected. Please align your face.");
        return;
    }

    if (!blinkDetected) {
        alert("⚠️ Please blink your eyes before capturing.");
        return;
    } 

    if (!isLightingLow) {
        alert("⚠️ Low light detected. Move to a brighter area.");
        return;
    } 

   // Ensure multiple faces are NOT detected
   if (document.getElementById("selfieStatus").innerText.includes("Multiple faces detected")) {
    alert("⚠️ Multiple faces detected! Please ensure only one face is visible.");
    return;
}
    

    let ctx = canvasElement.getContext("2d");
    canvasElement.width = videoElement.videoWidth;
    canvasElement.height = videoElement.videoHeight;
    ctx.drawImage(videoElement, 0, 0, canvasElement.width, canvasElement.height);

    canvasElement.toBlob(blob => {
        selfieBlob = new File([blob], "selfie.jpg", { type: "image/jpeg" });  
        
        //  Ensure the image is displayed in the first upload box
        const previewImage1 = document.getElementById("previewImage1");
        const fileName1 = document.getElementById("fileName1");

        previewImage1.src = URL.createObjectURL(selfieBlob);
        previewImage1.style.display = "block";
        fileName1.innerText = "Captured Selfie: selfie.jpg"; 

        document.getElementById("selfieStatus").innerText = "✅ Selfie captured successfully!";
        stopCamera();
        videoElement.style.display = "none";
        document.getElementById("captureSelfieBtn").style.display = "none";
        document.getElementById("uploadSection").style.display = "block";
    }, "image/jpeg");
});

// Image Upload 2 is now properly handled
document.getElementById("imageUpload2").addEventListener("change", function (event) {
    const file = event.target.files[0];
    if (file) {
        if (!allowedTypes.includes(file.type)) {
            alert("⚠️ Please upload a valid image file (JPG, JPEG, PNG, WEBP, GIF).");
            this.value = "";
            return;
        }
        
        image2 = file;  // ✅ Assign the uploaded file to global variable

        document.getElementById("previewImage2").src = URL.createObjectURL(file);
        // document.getElementById("previewImage2").src = fileURL;
        document.getElementById("previewImage2").style.display = "block";   // Makes an element visible
        document.getElementById("fileName2").innerText = file.name;

        // const image2 = document.getElementById("imageUpload2").files[0];
    } 
});

 // Ensure upload buttons trigger file input clicks 
 document.getElementById("Btn2").addEventListener("click", function () {
    document.getElementById("imageUpload2").click();
}); 

startFaceDetection
async function stopCamera() {
    if (cameraStream) {
        await faceMesh.close();
        cameraStream.getTracks().forEach(track => track.stop());
        videoElement.srcObject = null;
        cameraStream = null;
    }
    console.log("Camera fully stopped and released.");
}

// Face Comparison Now Works Properly
document.getElementById("compareBtn").addEventListener("click", async function () { 

     // Pause FaceMesh to free up processing power
       stopCamera(); 

    const image1 = document.getElementById("imageUpload1").files[0];
    const image2 = document.getElementById("imageUpload2").files[0];

    if (!selfieBlob) {
        alert("⚠️ You must capture a selfie first.");
        return;
    }

    if (!image2) {
        alert("⚠️ Please upload 2nd image for Comparison");
        return;
    }

    // FormData is used to construct a set of key-value pairs (similar to an HTML form) that can be sent in an HTTP request.
    let formData = new FormData();
    formData.append("image1", selfieBlob);
    // formData.append("image1", image1);
    formData.append("image2", image2);

    try {
        const response = await fetch("http://127.0.0.1:8000/compare_faces", {
            method: "POST",
            body: formData,
        }); 

        // fetch() is Asynchronous
        // Network requests take time, and JavaScript doesn't wait by default. If we don't use await, the code will continue running before the request is completed.

        const data = await response.json();
        console.log("API Response:", data);

        if (response.ok) {
            document.getElementById("result").innerText = `Face Match: ${data.match}`;
        } else {
            document.getElementById("result").innerText = `Error: ${data.message || "Unknown error"}`;
        }

    } catch (error) {
        console.error("Error comparing faces:", error);
        document.getElementById("result").innerText = "⚠️ Failed to compare faces.";
    }
    finally {
        // Resume FaceMesh only if needed
        startFaceDetection();
    }
});

