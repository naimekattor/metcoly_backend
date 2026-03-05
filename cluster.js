const cluster = require('cluster');
const os = require('os');

// On a real backend with a database, don't use ALL cores
// Use half to avoid overwhelming the DB connection pool
const NUM_WORKERS = Math.ceil(os.cpus().length / 2);

if (cluster.isMaster) {
  console.log(`Master PID: ${process.pid}`);
  console.log(`Starting ${NUM_WORKERS} workers (of ${os.cpus().length} CPUs)...`);

  for (let i = 0; i < NUM_WORKERS; i++) {
    cluster.fork();
  }

  cluster.on('exit', (worker, code, signal) => {
    console.log(`Worker ${worker.process.pid} died (${signal || code}). Restarting...`);
    cluster.fork();
  });

} else {
  // Each worker runs your existing server normally
  require('./server'); 
}