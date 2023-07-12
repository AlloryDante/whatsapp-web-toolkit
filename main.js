var updater = require("./updater");
const { Worker, isMainThread, parentPort, workerData } = require("worker_threads");
let worker;

updater.options.updateCheckInterval_seconds = 60;
updater.on("error", function (err, pkgName) {
  console.error(err);
});

updater.on("updateRequired", function () {
  console.log("Update required");
  try {
    worker.terminate();
  } catch (error) {}
  updater.update();
});
updater.on("updated", function () {
  console.log("Packages updated");
  startWorker();
});

startWorker();
updater.updateCheckerService(["whatsapp-web.js"]);

function startWorker() {
  worker = new Worker("./slave.js");
  worker.on("message", (msg) => console.log(`Worker message received: ${msg}`));
  worker.on("error", (err) => console.error(error));
  worker.on("exit", (code) => console.log(`Worker exited with code ${code}.`));
}
