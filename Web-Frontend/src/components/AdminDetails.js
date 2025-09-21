// /components/AdminDetails.jsx
import React from 'react';
import AdminFiles from './AdminFiles';
function AdminDetails({ admin }) {
  if (!admin) return <p>No admin selected</p>;
  return (
    <div>
      <h2>{admin.first_name} {admin.last_name}</h2>
      {/* Display other admin info as needed */}
      <AdminFiles
        uploadIdPath={admin.upload_id_path}
        uploadLetterPath={admin.upload_letter_path}
      />
    </div>
  );
}
export default AdminDetails;