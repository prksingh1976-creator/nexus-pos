import * as faceapi from '@vladmandic/face-api';
import { Customer } from '../types';

// Use a public CDN for the models. 
const MODEL_URL = 'https://cdn.jsdelivr.net/npm/@vladmandic/face-api/model/';

let modelsLoaded = false;

export const loadFaceModels = async () => {
    if (modelsLoaded) return true;
    try {
        await Promise.all([
            faceapi.nets.ssdMobilenetv1.loadFromUri(MODEL_URL),
            faceapi.nets.faceLandmark68Net.loadFromUri(MODEL_URL),
            faceapi.nets.faceRecognitionNet.loadFromUri(MODEL_URL)
        ]);
        modelsLoaded = true;
        return true;
    } catch (error) {
        console.error("Failed to load face models:", error);
        return false;
    }
};

export const getFaceDescriptor = async (videoElement: HTMLVideoElement): Promise<Float32Array | undefined> => {
    if (!modelsLoaded) return undefined;

    // Detect single face with landmarks and descriptor
    const detection = await faceapi.detectSingleFace(videoElement)
        .withFaceLandmarks()
        .withFaceDescriptor();

    return detection?.descriptor;
};

export const getAllFaceDescriptors = async (videoElement: HTMLVideoElement): Promise<Float32Array[]> => {
    if (!modelsLoaded) return [];

    // Detect all faces
    const detections = await faceapi.detectAllFaces(videoElement)
        .withFaceLandmarks()
        .withFaceDescriptors();

    return detections.map(d => d.descriptor);
};

export const findBestMatch = (
    descriptor: Float32Array, 
    customers: Customer[], 
    threshold = 0.55 // Lower is stricter (0.0 is exact match, > 0.6 is loose)
): Customer | null => {
    
    let bestMatch: Customer | null = null;
    let lowestDistance = 1.0;

    customers.forEach(customer => {
        if (customer.faceDescriptor && customer.faceDescriptor.length > 0) {
            // Convert stored array back to Float32Array
            const customerDescriptor = new Float32Array(customer.faceDescriptor);
            
            // Calculate Euclidean distance
            const distance = faceapi.euclideanDistance(descriptor, customerDescriptor);
            
            if (distance < lowestDistance) {
                lowestDistance = distance;
                bestMatch = customer;
            }
        }
    });

    return lowestDistance < threshold ? bestMatch : null;
};