const pool = require('../PostgreSQL/database');
const { getIo } = require('../socket');

async function checkExpiredPickups() {
  try {
    const now = new Date();

    // Fetch all requests that are "ready for pick-up" and have a pickup_deadline
    const result = await pool.query(
      `SELECT * FROM document_requests 
       WHERE status = 'ready for pick-up' 
       AND pickup_deadline IS NOT NULL`
    );

    const requests = result.rows;

    for (let request of requests) {
      const deadline = new Date(request.pickup_deadline);

      if (deadline < now) {
        // Update status to unclaimed
        const newHistoryItem = {
          label: "unclaimed",
          updated_by: "System",
          updated_at: now.toISOString(),
        };
        const updatedHistory = [...(request.status_history || []), newHistoryItem];

        const updateResult = await pool.query(
          `UPDATE document_requests
           SET status = 'unclaimed',
               updated_at = NOW(),
               status_history = $1::jsonb
           WHERE id = $2
           RETURNING *`,
          [JSON.stringify(updatedHistory), request.id]
        );

        const updatedRequest = updateResult.rows[0];

        // Emit socket event so frontend updates automatically
        try {
          const io = getIo();
          io.emit("documentRequestUpdate", {
            requestId: updatedRequest.id,
            status: updatedRequest.status,
            status_history: updatedRequest.status_history,
          });
          console.log(`🔔 Request ${updatedRequest.id} marked as unclaimed and emitted`);
        } catch (err) {
          console.warn("Socket.io not initialized:", err.message);
        }
      }
    }
  } catch (err) {
    console.error("❌ Error checking expired pickups:", err);
  }
}

module.exports = { checkExpiredPickups };
