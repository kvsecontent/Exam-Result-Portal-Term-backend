// This is only the relevant part of your existing code that needs to be modified
// Replace your current student lookup logic with this:

app.get('/api/student/:rollNumber', async (req, res) => {
  try {
    const rollNumber = req.params.rollNumber;
    const schoolCode = req.query.school_code;
    
    // Validate inputs
    if (!rollNumber || !schoolCode) {
      return res.status(400).json({
        success: false,
        message: 'Both admission number and school code are required'
      });
    }
    
    // Load sheet
    const doc = await loadSheet();
    const sheet = doc.sheetsByIndex[0];
    const rows = await sheet.getRows();
    
    // First find student with matching roll number
    const student = rows.find(row => row.Roll_Number === rollNumber);
    
    if (!student) {
      return res.status(404).json({
        success: false,
        message: 'Student not found. Please check admission number and try again.'
      });
    }
    
    // IMPORTANT: This is the key fix - strictly validate school code
    // Check if school code matches - convert both to strings, trim whitespace
    const correctSchoolCode = String(student.School_Code || '').trim();
    const providedSchoolCode = String(schoolCode).trim();
    
    if (correctSchoolCode !== providedSchoolCode) {
      return res.status(403).json({
        success: false,
        message: 'Invalid school code for this student.'
      });
    }
    
    // Continue with your existing code to process student data
    // ...
  } catch (error) {
    console.error('Error fetching student data:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while fetching student data'
    });
  }
});
