const pool = require('../../PostgreSQL/database');
const path = require('path');
const fs = require('fs');
const { getIo } = require('../../socket');
const {supabase} = require('../../PostgreSQL/supabaseClient');


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

    if (
      !documentType ||
      !purpose ||
      !date ||
      !time ||
      !mobile_user_id ||
      !region ||
      !province ||
      !city ||
      !barangay
    ) {      
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
      requested_by || null,
      region,
      province,
      city,
      barangay,
      date_of_birth || null,
      sex || null,
      home_address || null,
      civil_status || null,
    ];

    
    const { rows } = await pool.query(query, values);
    const savedReport = rows[0];

    const mobileUserId = req.body.mobile_user_id || req.user?.id;

    if (mobileUserId) {
      try {
        await pool.query(
          `INSERT INTO notifications 
          (mobile_user_id, region, province, city, barangay, type, document_type, is_read, created_at)
          VALUES ($1, $2, $3, $4, $5, $6, $7, FALSE, NOW())`,
          [
            mobileUserId,
            savedReport.region,
            savedReport.province,
            savedReport.city,
            savedReport.barangay,
            'newDocumentRequest',
            savedReport.document_type
          ]
        );

        console.log(`Notification created for mobile user ID ${mobileUserId}`);
      } catch (notifErr) {
        console.error('Failed to create notification:', notifErr.message);
      }
    } else {
      console.warn('No mobile_user_id provided; skipping notification creation.');
    }

    // Emit via socket.io
    try {
      const io = getIo();
      io.emit('newDocumentRequest', rows[0]);
    } catch (err) {
      console.warn('Socket.io not initialized:', err.message);
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



// =========================
// UPDATE DOCUMENT REQUEST STATUS
// =========================

const updateDocumentRequestStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const {
      status,
      first_name,
      last_name,
      new_date,
      price_amount,
      price_note,
      reason        
    } = req.body;

    console.log("Incoming status update:", { id, status, first_name, last_name, new_date, price_amount, price_note });
    const rejectionReason = (typeof reason === 'string' && reason.trim()) ? reason.trim() : null;

    if (status.toLowerCase() === "rejected") {
      sets.push(`rejection_reason = $${params.length + 1}`);
      params.push(rejectionReason);
    }

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

    // Validate amount fields when moving to "ready for pick-up"
    if (status.toLowerCase() === "ready for pick-up") {
      // allow 0, but not undefined/negative
      const amt = Number(price_amount);
      if (!Number.isFinite(amt) || amt < 0) {
        return res.status(400).json({ message: "price_amount must be a non-negative number when setting Ready for Pick-up." });
      }
    }

    // Get current request history
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

    // ===== PICKUP DEADLINE / NEW DATE =====
    let pickupDeadline = null;
    let finalNewDate = null;

    if (status.toLowerCase() === "ready for pick-up") {
      // TEST: +5 mins;
      pickupDeadline = new Date(Date.now() + 5 * 60 * 1000);
    }

    if (status.toLowerCase() === "reschedule" && new_date) {
      finalNewDate = new Date(new_date);
      // TEST: +5 mins after reschedule date
      pickupDeadline = new Date(finalNewDate.getTime() + 5 * 60 * 1000);

      console.log(`Status updated to: "${status}" by ${updatedBy}`);
      console.log(`Rescheduled date: ${finalNewDate}`);
      console.log(`Pickup deadline: ${pickupDeadline}`);
      console.log(`Updated status history:`, updatedHistory);
    }

    // Base columns always updated
    const sets = [
      `status = $1`,
      `updated_by = $2`,
      `updated_at = NOW()`,
      `status_history = $3::jsonb`,
      `pickup_deadline = $4`,
      `new_date = $5`
    ];
    const params = [
      status.toLowerCase(),
      updatedBy,
      JSON.stringify(updatedHistory),
      pickupDeadline,
      finalNewDate,
    ];

    // If Ready for Pick-up, also persist price 
    if (status.toLowerCase() === "ready for pick-up") {
      sets.push(`price_amount = $${params.length + 1}`);
      params.push(price_amount !== undefined && price_amount !== null ? Number(price_amount) : null);

      sets.push(`price_note = $${params.length + 1}`);
      params.push(price_note ?? null);
    }

    params.push(id);
    const sql = `
      UPDATE document_requests
      SET ${sets.join(", ")}
      WHERE id = $${params.length}
      RETURNING *
    `;

    const updateResult = await pool.query(sql, params);
    const updatedRequest = updateResult.rows[0];

    console.log(`Status updated to: "${updatedRequest.status}" by ${updatedBy}`);
    if (updatedRequest.new_date) {
      console.log(`Rescheduled date (new_date): ${updatedRequest.new_date}`);
    }
    if (updatedRequest.pickup_deadline) {
      console.log(`Pickup deadline: ${updatedRequest.pickup_deadline}`);
    }
    if (status.toLowerCase() === "ready for pick-up") {
      console.log(`Amount set:`, {
        price_amount: updatedRequest.price_amount,
        price_note: updatedRequest.price_note
      });
    }
    console.log(`Updated status history:`, updatedRequest.status_history);

    // Create mobile notification
    const notificationQuery = `
      INSERT INTO mobile_notifications
      (mobile_user_id, type, status, reason_for_rejection, document_type, request_id)
      VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING *
    `;
    const notificationValues = [
      updatedRequest.mobile_user_id,
      'document_request_status',
      status.toLowerCase(),
      status.toLowerCase() === 'rejected' ? rejectionReason : null,
      updatedRequest.document_type,
      updatedRequest.id,
    ];

    let notification = null;
    try {
      const notificationResult = await pool.query(notificationQuery, notificationValues);
      notification = notificationResult.rows[0];
      console.log("Notification saved successfully:", notification);
    } catch (err) {
      console.error("Failed to save notification:", err);
    }

    const io = getIo();

    // Emit to the specific mobile user room
    io.to(`user_${updatedRequest.mobile_user_id}`).emit('documentRequestUpdate', {
      id: updatedRequest.id,
      status: updatedRequest.status,
      status_history: updatedRequest.status_history,
      updated_by: updatedRequest.updated_by,
      updated_at: updatedRequest.updated_at,
      document_type: updatedRequest.document_type,
      date: updatedRequest.date,
      time: updatedRequest.time,
      city: updatedRequest.city,
      province: updatedRequest.province,
      barangay: updatedRequest.barangay,
      pickup_date: updatedRequest.pickup_date,
      new_date: updatedRequest.new_date,
      pickup_deadline: updatedRequest.pickup_deadline,
      price_amount: updatedRequest.price_amount,
      price_note: updatedRequest.price_note,
      rejection_reason: updatedRequest.rejection_reason,
      requestId: updatedRequest.id,
    });

    // Also broadcast to BRGY dashboards 
    io.emit('documentRequestUpdate', {
      requestId: updatedRequest.id,
      status: updatedRequest.status,
      status_history: updatedRequest.status_history,
      updated_by: updatedRequest.updated_by,
      updated_at: updatedRequest.updated_at,
      price_amount: updatedRequest.price_amount,
      price_note: updatedRequest.price_note,
      rejection_reason: updatedRequest.rejection_reason,
    });

    return res.status(200).json({
      message: "Status updated successfully",
      report: updatedRequest,
    });
  } catch (error) {
    console.error("[updateDocumentRequestStatus] Error:", error);
    return res.status(500).json({ message: "Server error", error: error.message });
  }
};


// =========================
// GET DOCUMENT REQUEST BY USER ID
// =========================

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

        request.status = "unclaimed";
        request.status_history = [
          ...(request.status_history || []),
          {
            label: "unclaimed",
            updated_by: "System",
            updated_at: now.toISOString(),
          },
        ];
        
        // Emit via socket.io
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

// =========================
// GET DOCUMENT REQUESTS BY LOCATION
// =========================
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

        // Emit via socket.io
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
// from Controller/BARANGAY/documentRequest.js

const rejectDocumentRequest = async (req, res) => {
  const where = "[rejectDocumentRequest]";
  try {
    const { requestId } = req.params;
    const { reason, first_name, last_name } = req.body;

    console.log(`${where} hit`, { requestId, reason, first_name, last_name });

    // Basic validation
    if (!requestId) {
      console.warn(`${where} 400: missing requestId param`);
      return res.status(400).json({ message: "Missing requestId" });
    }
    if (!reason || !reason.trim()) {
      console.warn(`${where} 400: missing rejection reason`);
      return res.status(400).json({ message: "Rejection reason is required" });
    }

    const updatedBy = (
      `${first_name || req.user?.first_name || ""} ${last_name || req.user?.last_name || ""}`
    ).trim() || "Unknown";

    // Fetch current history + mobile user id for notifications
    const { rows } = await pool.query(
      `SELECT id, mobile_user_id, status, status_history
       FROM document_requests
       WHERE id = $1`,
      [requestId]
    );

    if (!rows.length) {
      console.warn(`${where} 404: request not found`, { requestId });
      return res.status(404).json({ message: "Document request not found" });
    }

    const current = rows[0];
    const currentHistory = Array.isArray(current.status_history) ? current.status_history : [];

    // Build history entry 
    const newHistoryItem = {
      label: "rejected",
      updated_by: updatedBy,
      updated_at: new Date().toISOString(),
      reason: reason.trim(),
    };
    const updatedHistory = [...currentHistory, newHistoryItem];

    const updateSql = `
      UPDATE document_requests
      SET status = $1,
          updated_by = $2,
          updated_at = NOW(),
          status_history = $3::jsonb,
          rejection_reason = $4
      WHERE id = $5
      RETURNING *`;
    const updateParams = ["rejected", updatedBy, JSON.stringify(updatedHistory), reason.trim(), requestId];

    console.log(`${where} running UPDATE`, { sql: "document_requests", requestId, status: "rejected" });

    const updateResult = await pool.query(updateSql, updateParams);
    const updatedRequest = updateResult.rows[0];

    console.log(`${where} updated OK`, {
      id: updatedRequest.id,
      status: updatedRequest.status,
      updated_by: updatedRequest.updated_by,
    });

    // Create mobile notification
    let notification = null;
    try {
      const notificationResult = await pool.query(
        `INSERT INTO mobile_notifications
        (mobile_user_id, type, status, reason_for_rejection, request_id, is_read, created_at)
        VALUES ($1, $2, $3, $4, $5 FALSE, NOW())
        RETURNING *`,
        [
          updatedRequest.mobile_user_id,
          "document_request_status",
          "rejected",
          reason.trim()
        ]
      );
      notification = notificationResult.rows[0];
      console.log(`${where} notification saved`, { notificationId: notification.id });
    } catch (err) {
      console.error(`${where} failed to save notification`, err);
    }

    // Emit only to the mobile user
    try {
      const io = getIo();
      io.to(`user_${updatedRequest.mobile_user_id}`).emit("documentRequestUpdate", {
        type: "document_request_status",
        status: updatedRequest.status,
        id: updatedRequest.id,
        request_id: updatedRequest.id,
        status_history: updatedRequest.status_history,
        updated_by: updatedRequest.updated_by,
        updated_at: updatedRequest.updated_at,
        new_date: updatedRequest.new_date,
        pickup_deadline: updatedRequest.pickup_deadline,
        rejection_reason: updatedRequest.rejection_reason,
        reason_for_rejection: updatedRequest.rejection_reason,
        created_at: new Date().toISOString(),
      });

      console.log("[rejectDocumentRequest] socket emitted", {
        room: `user_${updatedRequest.mobile_user_id}`,
        requestId: updatedRequest.id,
        status: updatedRequest.status
      });
    } catch (err) {
      console.error("[rejectDocumentRequest] socket emit error", err);
    }


    return res.status(200).json({
      message: "Document request rejected successfully",
      request: updatedRequest,
    });
  } catch (error) {
    console.error(`${where} 500`, error);
    return res.status(500).json({ message: "Server error", error: error.message });
  }
};




module.exports = {
    createDocumentRequest,
    getRequestsByUserId,
    getRequestsByLocation,
    updateDocumentRequestStatus,
    rejectDocumentRequest
}