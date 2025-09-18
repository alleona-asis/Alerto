const pool = require('../../PostgreSQL/database');
const path = require('path');
const fs = require('fs');
const { getIo } = require('../../socket');

// =================================================
//  CREATE DOCUMENT REQUEST
// =================================================
const createDocumentRequest = async (req, res) => {
  try {
    const {
      documentType,
      purpose,
      date,
      time,
      additionalNotes,
      mobile_user_id,
      requested_by,
      region,
      province,
      city,
      barangay,
      date_of_birth,
      sex,
      home_address,
      civil_status
    } = req.body;

    // Validate required fields
    if (!documentType || !purpose || !date || !time || !mobile_user_id || !region || !province || !city || !barangay || !date_of_birth || !sex || !home_address || !civil_status) {
      return res.status(400).json({ message: 'Missing required fields.' });
    }

    const query = `
      INSERT INTO document_requests
      (document_type, purpose, date, time, additional_notes, mobile_user_id, requested_by, region, province, city, barangay, date_of_birth, sex, home_address, civil_status)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)
      RETURNING *;
    `;

    const values = [
      documentType,
      purpose,
      date,
      time,
      additionalNotes || null,
      mobile_user_id,
      requested_by,
      region,
      province,
      city,
      barangay,
      date_of_birth,
      sex,
      home_address,
      civil_status
    ];

const { rows } = await pool.query(query, values);
const savedReport = rows[0]; // <-- THIS replaces result.rows[0]

const mobileUserId = req.body.mobile_user_id || req.user?.id;

if (mobileUserId) {
  try {
    await pool.query(
      `INSERT INTO notifications 
       (mobile_user_id, region, province, city, barangay, type, document_type, is_read, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, FALSE, NOW())`,
      [
        mobileUserId,             // $1
        savedReport.region,       // $2
        savedReport.province,     // $3
        savedReport.city,         // $4
        savedReport.barangay,     // $5
        'newDocumentRequest',     // $6
        savedReport.document_type // $7
      ]
    );

    console.log(`Notification created for mobile user ID ${mobileUserId}`);
  } catch (notifErr) {
    console.error('Failed to create notification:', notifErr.message);
  }
} else {
  console.warn('⚠️ No mobile_user_id provided; skipping notification creation.');
}

    // Emit via socket.io
    try {
      const io = getIo();
      io.emit('newDocumentRequest', rows[0]);
    } catch (err) {
      console.warn('⚠️ Socket.io not initialized:', err.message);
    }

    res.status(201).json({
      message: 'Document request submitted successfully',
      request: rows[0],
    });
  } catch (error) {
    console.error('Error creating document request:', error);
    res.status(500).json({ message: 'Server error' });
  }
};





/*
const getRequestsByUserId = async (req, res) => {
  try {
    const userId = req.params.id;
    if (!userId) {
      return res.status(400).json({ error: "User ID missing" });
    }

    console.log("Fetching reports for userId:", userId);

    const query = `
      SELECT *
      FROM document_requests
      WHERE mobile_user_id = $1
      ORDER BY date DESC
    `;
    const result = await pool.query(query, [userId]);

    res.json(result.rows);
  } catch (err) {
    console.error("Error fetching user reports:", err);
    res.status(500).json({ error: "Server error" });
  }
};
*/



// =================================================
// =================================================
//  Barangay Web Dashboard
// =================================================
// =================================================
/*
const getRequestsByLocation = async (req, res) => {
  try {
    const { city, province, barangay } = req.query;

    const result = await pool.query(
      'SELECT * FROM document_requests WHERE city = $1 AND province = $2 AND barangay = $3',
      [city, province, barangay]
    );

    res.status(200).json(result.rows);
  } catch (error) {
    console.error('Error fetching pins:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
};
*/

/*
    // ===== PICKUP DEADLINE =====
    let pickupDeadline = null;

      if (status.toLowerCase() === "ready for pick-up" || status.toLowerCase() === "reschedule") {
      // TEMPORARY: 5 minutes for testing
      const tempDate = new Date(Date.now() + 5 * 60 * 1000); 

      // 1 day from now
      //const tempDate = new Date(Date.now() + 24 * 60 * 60 * 1000);

      const options = {
        year: "numeric",
        month: "short",  // Sep
        day: "numeric",
        hour: "numeric",
        minute: "2-digit",
        hour12: true
      };
      pickupDeadline = tempDate.toLocaleString("en-US", options);
    }

    // Update document request
    const updateResult = await pool.query(
      `UPDATE document_requests
       SET status = $1,
           updated_by = $2,
           updated_at = NOW(),
           status_history = $3::jsonb,
           pickup_deadline = $4
       WHERE id = $5
       RETURNING *`,
      [status.toLowerCase(), updatedBy, JSON.stringify(updatedHistory), pickupDeadline, id]
    );
*/



const updateDocumentRequestStatus = async (req, res) => {
  try {
    const { id } = req.params;
    //const { status, first_name, last_name } = req.body;
    const { status, first_name, last_name, new_date } = req.body;

    console.log("🔹 Incoming status update:", { id, status, first_name, last_name, new_date });

    const updatedBy =
      `${first_name || req.user?.first_name || ''} ${last_name || req.user?.last_name || ''}`.trim() || "Unknown";

    if (!id || !status) {
      return res.status(400).json({ message: "Missing report ID or status" });
    }

    const allowedStatuses = [
      "submitted",
      "processing",
      "accepted",
      "rejected",
      "reschedule",
      "ready for pick-up",
      "claimed",
      "unclaimed",
    ];

    if (!allowedStatuses.includes(status.toLowerCase())) {
      return res.status(400).json({ message: "Invalid status" });
    }

    const { rows } = await pool.query(
      `SELECT status_history FROM document_requests WHERE id = $1`,
      [id]
    );
    const currentHistory = rows[0]?.status_history || [];

    const newHistoryItem = {
      label: status.toLowerCase(),
      updated_by: updatedBy,
      updated_at: new Date().toISOString(),
    };
    const updatedHistory = [...currentHistory, newHistoryItem];

// ===== PICKUP DEADLINE =====
let pickupDeadline = null;
let finalNewDate = null;

if (status.toLowerCase() === "ready for pick-up") {
  // 5 minutes from now
  pickupDeadline = new Date(Date.now() + 5 * 60 * 1000);
}

// Only for reschedule
if (status.toLowerCase() === "reschedule" && new_date) {
  finalNewDate = new Date(new_date); // make sure it's a Date object
  pickupDeadline = new Date(finalNewDate.getTime() + 5 * 60 * 1000); // 5 minutes after newDate

  console.log(`📝 Status updated to: "${status}" by ${updatedBy}`);
  console.log(`📅 Rescheduled date: ${finalNewDate}`);
  console.log(`⏰ Pickup deadline: ${pickupDeadline}`);
  console.log(`🔹 Updated status history:`, updatedHistory);
}

// Logs
console.log(`📝 Status updated to: "${status}" by ${updatedBy}`);
if (finalNewDate) console.log(`📅 Rescheduled date set to: ${finalNewDate}`);
if (pickupDeadline) console.log(`⏰ Pickup deadline: ${pickupDeadline}`);
console.log(`🔹 Updated status history:`, updatedHistory);


// Update document request
const updateResult = await pool.query(
  `UPDATE document_requests
   SET status = $1,
       updated_by = $2,
       updated_at = NOW(),
       status_history = $3::jsonb,
       pickup_deadline = $4,
       new_date = $5
   WHERE id = $6
   RETURNING *`,
  [status.toLowerCase(), updatedBy, JSON.stringify(updatedHistory), pickupDeadline, finalNewDate, id]
);


    const updatedRequest = updateResult.rows[0];
    
// 🔹 Log the new date and pickup deadline clearly
console.log(`📝 Status updated to: "${updatedRequest.status}" by ${updatedBy}`);
if (updatedRequest.new_date) {
  console.log(`📅 Rescheduled date (new_date): ${updatedRequest.new_date}`);
}
if (updatedRequest.pickup_deadline) {
  console.log(`⏰ Pickup deadline: ${updatedRequest.pickup_deadline}`);
}
console.log(`🔹 Updated status history:`, updatedRequest.status_history);





    // 4️⃣ Save notification
    const notificationQuery = `
      INSERT INTO mobile_notifications
        (mobile_user_id, type, status)
      VALUES ($1, $2, $3)
      RETURNING *
    `;

    const notificationValues = [
      updatedRequest.mobile_user_id,
      'document_request_status',
      status.toLowerCase(),  // ← use the actual updated status
    ];

    let notification = null;
    try {
      const notificationResult = await pool.query(
        notificationQuery,
        notificationValues
      );
      notification = notificationResult.rows[0];
      console.log(
        "📲 Notification saved successfully:",
        notification
      );
    } catch (err) {
      console.error("❌ Failed to save notification:", err);
    }

        // --- Emit notification ONLY to the mobile user ---
    if (notification) {
      const io = getIo();
      io.to(`user_${updatedRequest.mobile_user_id}`).emit(
        "documentRequestUpdate",
        {
          ...notification,
          type: "document_request_status",
        }
      );
    }

    res.status(200).json({
      message: "Status updated successfully",
      report: updatedRequest,
    });
  } catch (error) {
    console.error("[updateDocumentRequestStatus] Error:", error);
    res.status(500).json({ message: "Server error", error: error.message });
  }
};


const getRequestsByUserId = async (req, res) => {
  try {
    const userId = req.params.id;
    if (!userId) return res.status(400).json({ error: "User ID missing" });

    const result = await pool.query(
      `SELECT * FROM document_requests WHERE mobile_user_id = $1 ORDER BY date DESC`,
      [userId]
    );
    const requests = result.rows;

    const now = new Date();

    for (let request of requests) {
      if (
        request.status === "ready for pick-up" &&
        request.pickup_deadline &&
        new Date(request.pickup_deadline) < now
      ) {
        // Update status to unclaimed
        await pool.query(
          `UPDATE document_requests
           SET status = 'unclaimed',
               updated_at = NOW(),
               status_history = status_history || $1::jsonb
           WHERE id = $2`,
          [
            JSON.stringify([
              {
                label: "unclaimed",
                updated_by: "System",
                updated_at: now.toISOString(),
              },
            ]),
            request.id,
          ]
        );

        // Update the object in memory for response
        request.status = "unclaimed";
        request.status_history = [
          ...(request.status_history || []),
          {
            label: "unclaimed",
            updated_by: "System",
            updated_at: now.toISOString(),
          },
        ];
        
        // 🔹 Emit update to frontend
        io.emit("documentRequestUpdate", {
          requestId: request.id,
          status: "unclaimed",
          status_history: request.status_history,
        });
      }
    }

    res.json(requests);
  } catch (err) {
    console.error("Error fetching user reports:", err);
    res.status(500).json({ error: "Server error" });
  }
};


const getRequestsByLocation = async (req, res) => {
  try {
    const { city, province, barangay } = req.query;

    const result = await pool.query(
      'SELECT * FROM document_requests WHERE city = $1 AND province = $2 AND barangay = $3',
      [city, province, barangay]
    );
    const requests = result.rows;

    const now = new Date();

    for (let request of requests) {
      if (
        request.status === "ready for pick-up" &&
        request.pickup_deadline &&
        new Date(request.pickup_deadline) < now
      ) {
        await pool.query(
          `UPDATE document_requests
           SET status = 'unclaimed',
               updated_at = NOW(),
               status_history = status_history || $1::jsonb
           WHERE id = $2`,
          [
            JSON.stringify([
              {
                label: "unclaimed",
                updated_by: "System",
                updated_at: now.toISOString(),
              },
            ]),
            request.id,
          ]
        );

        request.status = "unclaimed";
        request.status_history = [
          ...(request.status_history || []),
          {
            label: "unclaimed",
            updated_by: "System",
            updated_at: now.toISOString(),
          },
        ];
        // 🔹 Emit update to frontend
        io.emit("documentRequestUpdate", {
          requestId: request.id,
          status: "unclaimed",
          status_history: request.status_history,
        });

      }
    }

    res.status(200).json(requests);
  } catch (error) {
    console.error('Error fetching pins:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
};








// =========================
// REJECT DOCUMENT REQUEST
// =========================
const rejectDocumentRequest = async (req, res) => {
  try {
    const { requestId } = req.params;
    const { first_name, last_name, reason } = req.body;

    if (!requestId || !reason) {
      return res.status(400).json({ message: "Request ID and rejection reason are required" });
    }

    const updatedBy =
      `${first_name || req.user?.first_name || ''} ${last_name || req.user?.last_name || ''}`.trim() || "Unknown";


    // Fetch current request and status history
    const { rows } = await pool.query(
      `SELECT status_history FROM document_requests WHERE id = $1`,
      [requestId]
    );

    if (!rows.length) {
      return res.status(404).json({ message: "Document request not found" });
    }

    const currentHistory = rows[0].status_history || [];

    // Append new history item
    const newHistoryItem = {
      label: "rejected",
      reason,
      updated_by: updatedBy,
      updated_at: new Date().toISOString()
    };
    const updatedHistory = [...currentHistory, newHistoryItem];

    // Update the request
    const updateResult = await pool.query(
      `UPDATE document_requests
       SET status = 'rejected',
           updated_by = $1,
           updated_at = NOW(),
           rejection_reason = $2,
           status_history = $3::jsonb
       WHERE id = $4
       RETURNING *`,
      [updatedBy, reason, JSON.stringify(updatedHistory), requestId]
    );

    const updatedRequest = updateResult.rows[0];

    // -----------------------------
    // Save verification status notification to database
    // -----------------------------
    const notificationQuery = `
      INSERT INTO mobile_notifications
        (mobile_user_id, type, status)
      VALUES ($1, $2, $3)
      RETURNING *
    `;

    // DEBUG: Check what values we are inserting
    const notificationValues = [
      req.user?.id || null, // whoever is logged in
      'document_request_status',
      status.toLowerCase(),
    ];
    console.log("🔹 Attempting to save notification with values:", notificationValues);

    try {
      const notificationResult = await pool.query(notificationQuery, notificationValues);
      const notification = notificationResult.rows[0];
      console.log("📲 Notification saved successfully:", notification);
    } catch (err) {
      console.error("❌ Failed to save notification:", err.message);
      console.error("Full error:", err);
    }


    // Emit socket event
    const io = getIo();
    io.emit("documentRequestUpdate", {
      requestId: updatedRequest.id,
      status: updatedRequest.status,
      status_history: updatedRequest.status_history,
    });

    return res.status(200).json({
      message: "Document request rejected successfully",
      report: updatedRequest
    });
  } catch (error) {
    console.error("❌ Reject document request error:", error);
    return res.status(500).json({ message: "Failed to reject document request", error: error.message });
  }
};




module.exports = {
    createDocumentRequest,
    getRequestsByUserId,
    getRequestsByLocation,
    updateDocumentRequestStatus,
    rejectDocumentRequest
}