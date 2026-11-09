// Runs the photo conversion off the main thread so the screen stays responsive.
importScripts('convert.js');
self.onmessage = (e) => {
  const { id, job } = e.data;
  try {
    self.postMessage({ id, result: self.PBNConvert.run(job) });
  } catch (err) {
    self.postMessage({ id, error: err && err.message ? err.message : String(err) });
  }
};
