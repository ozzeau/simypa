import { supabase } from './supabaseClient'; // Assuming this path is correct

// --- START HELPERS (Moved from CanvasBoard.js) ---

/**
 * Calculates a bounding box for a set of Point[]
 */
const getOutlineFromPoints = (points) => {
  if (!points || points.length < 1) return null;
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const point of points) {
    minX = Math.min(minX, point[0]);
    minY = Math.min(minY, point[1]);
    maxX = Math.max(maxX, point[0]);
    maxY = Math.max(maxY, point[1]);
  }
  return { x: minX - 10, y: minY - 10, width: (maxX - minX) + 20, height: (maxY - minY) + 20 };
};

/**
 * Calculates a bounding box for a set of Point[][]
 */
const getOutlineFromStrokes = (strokes) => {
  if (!strokes || strokes.length < 1) return null;
  const points = strokes.flat(); // Flatten all strokes into one array of points
  if (points.length < 1) return null;
  return getOutlineFromPoints(points); // Reuse the original logic
};

// --- END HELPERS ---

/**
 * Universal helper to process any signature row from Supabase.
 * It parses points and calculates the correct outline, handling both formats.
 * @param {object} sig - A single signature row from Supabase.
 */
const processSignature = (sig) => {
  try {
    const points = JSON.parse(sig.signature);

    // Check data format.
    const isMultiStroke = points && points.length > 0 &&
                          Array.isArray(points[0]) &&
                          points[0].length > 0 &&
                          Array.isArray(points[0][0]);
    
    let outline;
    if (isMultiStroke) {
      outline = getOutlineFromStrokes(points); // Use new helper
    } else {
      outline = getOutlineFromPoints(points); // Use old helper
    }

    // Return the full object, processed and ready for the app state
    return {
      ...sig,
      points: points,
      outline: outline
    };

  } catch (e) {
    // This catches old "data:image..." strings and other invalid JSON
    console.warn(`Skipping bad signature data (id: ${sig.id}): ${e.message}`);
    return null;
  }
};


/**
 * Fetches all signatures from the database.
 */
export const fetchSignatures = async () => {
  const { data, error } = await supabase
    .from('signatures')
    .select('*')
    .order('created_at');
  
  if (error) {
    console.error("Error fetching signatures:", error);
    throw error;
  }
  
  // Process every row and filter out any bad data
  return data
    .map(processSignature)
    .filter(Boolean);
};

/**
 * Stores a new signature in the database.
 * @param {object} sig - The signature object to store.
 * NOW ONLY expects { signature, caption }
 */
export const storeSignature = async (sig) => {
  // 'sig' should ONLY contain { signature, caption }
  // This fixes the 400 Bad Request error.
  const { data, error } = await supabase
    .from('signatures')
    .insert([sig])
    .select();
  
  if (error) {
    console.error("Error storing signature:", error);
    throw error;
  }

  if (data && data[0]) {
    // Process the newly saved row to add .points and .outline
    // before sending it back to the component.
    return processSignature(data[0]); 
  }
  
  return null;
};