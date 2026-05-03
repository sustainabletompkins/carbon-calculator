import { useState, useEffect } from "react";
import { db } from "../firebase";
import { doc, getDoc } from "firebase/firestore";

export default function FirestoreTest() {
  const [personData, setPersonData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchPersonData = async () => {
      try {
        setLoading(true);
        const docRef = doc(db, "testing", "person");
        const docSnap = await getDoc(docRef);

        if (docSnap.exists()) {
          setPersonData(docSnap.data());
          setError(null);
        } else {
          setError("Document not found");
          setPersonData(null);
        }
      } catch (err) {
        setError(`Error fetching data: ${err.message}`);
        setPersonData(null);
      } finally {
        setLoading(false);
      }
    };

    fetchPersonData();
  }, []);

  return (
    <div className="max-w-2xl mx-auto p-8 bg-white dark:bg-slate-800 rounded-lg shadow">
      <h1 className="text-3xl font-bold mb-6 text-text-light dark:text-text-dark">
        Firestore Test
      </h1>

      {loading && (
        <div className="flex items-center justify-center py-8">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-green-600"></div>
          <p className="ml-4 text-gray-600 dark:text-gray-400">Loading...</p>
        </div>
      )}

      {error && (
        <div className="bg-red-100 dark:bg-red-900 border border-red-400 dark:border-red-700 text-red-700 dark:text-red-200 px-4 py-3 rounded">
          <strong>Error:</strong> {error}
        </div>
      )}

      {personData && (
        <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg p-6">
          <h2 className="text-xl font-semibold mb-4 text-green-900 dark:text-green-100">
            ✓ Successfully loaded data
          </h2>
          <div className="space-y-3">
            <div className="bg-white dark:bg-slate-700 p-4 rounded">
              <p className="text-sm font-medium text-gray-500 dark:text-gray-400">
                Collection:{" "}
                <code className="text-gray-700 dark:text-gray-300">
                  testing
                </code>
              </p>
              <p className="text-sm font-medium text-gray-500 dark:text-gray-400">
                Document:{" "}
                <code className="text-gray-700 dark:text-gray-300">Person</code>
              </p>
            </div>
            <div className="bg-white dark:bg-slate-700 p-4 rounded">
              <h3 className="font-semibold text-gray-700 dark:text-gray-300 mb-2">
                Document Data:
              </h3>
              <pre className="bg-gray-100 dark:bg-slate-600 p-3 rounded text-sm overflow-auto text-gray-800 dark:text-gray-200">
                {JSON.stringify(personData, null, 2)}
              </pre>
            </div>
            {personData.name && (
              <div className="bg-white dark:bg-slate-700 p-4 rounded">
                <p className="text-gray-600 dark:text-gray-400">
                  <span className="font-semibold">Name field:</span>{" "}
                  <span className="text-lg text-green-600 dark:text-green-400 font-medium">
                    {personData.name}
                  </span>
                </p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
