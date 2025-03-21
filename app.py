import os  
import cv2
import torch
import tempfile
import numpy as np
import insightface
from fastapi import FastAPI, File, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from insightface.app import FaceAnalysis
from sklearn.metrics.pairwise import cosine_similarity


app = FastAPI()

# Enable CORS for frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Change this in production
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Initialize RetinaFace + ArcFace (on CPU)
face_analyzer = FaceAnalysis(name="buffalo_l", providers=["CPUExecutionProvider"])
face_analyzer.prepare(ctx_id=0)

def save_uploaded_file(uploaded_file):
    """Save an uploaded file to a temporary location and return the file path."""
    try:
        temp_file = tempfile.NamedTemporaryFile(delete=False, suffix=".jpg")
        temp_file.write(uploaded_file.file.read())
        temp_file.flush()  # Ensure data is written
        temp_file.close()
        return temp_file.name  # Return the file path
    except Exception as e:
        print(f"[ERROR] Failed to save uploaded file: {str(e)}")
        return None
def extract_face_embedding(image_path):
    """Detect and extract facial embeddings using ArcFace."""
    try:
        img = cv2.imread(image_path)
        if img is None:
            raise ValueError(f"Invalid or corrupted image file: {image_path}")

        faces = face_analyzer.get(img)
        num_faces = len(faces)

        if num_faces == 0:
            print(f"[DEBUG] No face detected in {image_path}")
            return None, "No face detected."

        if num_faces > 1:
            print(f"[DEBUG] Multiple faces detected ({num_faces}) in {image_path}")
            return None, f"Multiple faces detected ({num_faces}). Only one face is allowed."

        face = max(faces, key=lambda x: x.bbox[2] - x.bbox[0])  # Pick the largest face
        embedding = face.normed_embedding

        if embedding is None or len(embedding) == 0:
            return None, "Failed to extract face embedding."

        return embedding / np.linalg.norm(embedding), None  # Normalize the embedding
    except Exception as e:
        print(f"[ERROR] Face extraction error: {str(e)}")
        return None, str(e)

@app.post("/compare_faces/")
async def compare_faces(image1: UploadFile = File(...), image2: UploadFile = File(...)):
    """Compare two face images and return a similarity score."""

    # Save uploaded images
    temp1_path = save_uploaded_file(image1)
    temp2_path = save_uploaded_file(image2)

    if temp1_path is None or temp2_path is None:
        return {"match": "NO ❌", "similarity_score": 0.0, "message": "Failed to save uploaded images."}

    # Extract facial embeddings
    embedding1, error1 = extract_face_embedding(temp1_path)
    embedding2, error2 = extract_face_embedding(temp2_path)

    # Cleanup temporary images
    os.remove(temp1_path)
    os.remove(temp2_path)

    # If either embedding is missing, return failure
    if embedding1 is None or embedding2 is None:
        return {
            "match": "NO ❌",
            "similarity_score": 0.0,
            "message": error1 or error2
        }

    # Compute cosine similarity
    similarity = cosine_similarity([embedding1], [embedding2])[0][0]

    # Set a better threshold
    match = similarity > 0.30

    return {
        "match": "YES ✅" if match else "NO ❌",
        "similarity_score": round(float(similarity), 3),
    }

# Run FastAPI app
if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="127.0.0.1", port=8000, reload=True)
