import { useState, useEffect, useRef, useCallback } from 'react';
import * as faceapi from '@vladmandic/face-api';

const MODEL_URL = '/models';

export default function useFaceApi() {
    const [modelsLoaded, setModelsLoaded] = useState(false);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const loadedRef = useRef(false);

    // Load face-api models
    useEffect(() => {
        async function loadModels() {
            if (loadedRef.current) return;
            loadedRef.current = true;

            try {
                setLoading(true);
                console.log('Loading face-api models...');

                await Promise.all([
                    faceapi.nets.tinyFaceDetector.loadFromUri(MODEL_URL),
                    faceapi.nets.faceLandmark68Net.loadFromUri(MODEL_URL),
                    faceapi.nets.faceRecognitionNet.loadFromUri(MODEL_URL),
                ]);

                console.log('Face-api models loaded successfully');
                setModelsLoaded(true);
                setError(null);
            } catch (err) {
                console.error('Failed to load face-api models:', err);
                setError('Gagal memuat model face recognition');
            } finally {
                setLoading(false);
            }
        }

        loadModels();
    }, []);

    // Detect face and get descriptor from image element or canvas
    const detectFace = useCallback(async (imageElement) => {
        if (!modelsLoaded) {
            throw new Error('Model face recognition belum dimuat');
        }

        const detection = await faceapi
            .detectSingleFace(imageElement, new faceapi.TinyFaceDetectorOptions({ inputSize: 224, scoreThreshold: 0.5 }))
            .withFaceLandmarks()
            .withFaceDescriptor();

        if (!detection) {
            return null;
        }

        return {
            descriptor: Array.from(detection.descriptor),
            box: detection.detection.box,
            landmarks: detection.landmarks,
            score: detection.detection.score
        };
    }, [modelsLoaded]);

    // Compare two face descriptors and return distance
    const compareFaces = useCallback((descriptor1, descriptor2) => {
        if (!descriptor1 || !descriptor2) {
            return { match: false, distance: 1 };
        }

        // Ensure descriptors are Float32Arrays
        const d1 = descriptor1 instanceof Float32Array ? descriptor1 : new Float32Array(descriptor1);
        const d2 = descriptor2 instanceof Float32Array ? descriptor2 : new Float32Array(descriptor2);

        const distance = faceapi.euclideanDistance(d1, d2);

        // Threshold for face match (lower is better)
        const MATCH_THRESHOLD = 0.4; // Minimal kemiripan 60%

        return {
            match: distance < MATCH_THRESHOLD,
            distance: distance,
            similarity: Math.max(0, Math.round((1 - distance) * 100))
        };
    }, []);

    // Detect face from video element (for live camera)
    const detectFaceFromVideo = useCallback(async (videoElement) => {
        if (!modelsLoaded || !videoElement) {
            return null;
        }

        return await detectFace(videoElement);
    }, [modelsLoaded, detectFace]);

    // Detect face from image URL or base64
    const detectFaceFromImage = useCallback(async (imageSrc) => {
        if (!modelsLoaded) {
            throw new Error('Model face recognition belum dimuat');
        }

        return new Promise((resolve, reject) => {
            const img = new Image();
            img.crossOrigin = 'anonymous';
            img.onload = async () => {
                try {
                    const result = await detectFace(img);
                    resolve(result);
                } catch (err) {
                    reject(err);
                }
            };
            img.onerror = () => reject(new Error('Gagal memuat gambar'));
            img.src = imageSrc;
        });
    }, [modelsLoaded, detectFace]);

    return {
        modelsLoaded,
        loading,
        error,
        detectFace,
        detectFaceFromVideo,
        detectFaceFromImage,
        compareFaces,
    };
}
