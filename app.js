// server.js or index.js
const express = require('express');
const { GoogleSpreadsheet } = require('google-spreadsheet');
const cors = require('cors');
const app = express();
const port = process.env.PORT || 3000;

// Middleware
app.use(express.json());
app.use(cors());

// Google Sheet API credentials
const SPREADSHEET_ID = process.env.SPREADSHEET_ID; // Your Google Sheet ID
const GOOGLE_SERVICE_ACCOUNT_EMAIL = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
const GOOGLE_PRIVATE_KEY = process.env.GOOGLE_PRIVATE_KEY.replace(/\\n/g, '\n');

// Connect to Google Sheet
async function loadSheet() {
  const doc = new GoogleSpreadsheet(SPREADSHEET_ID);
  
  await doc.useServiceAccountAuth({
    client_email: GOOGLE_SERVICE_ACCOUNT_EMAIL,
    private_key: GOOGLE_PRIVATE_KEY,
  });
  
  await doc.loadInfo();
  return doc;
}

// API endpoint to get student result by roll number and school code
app.get('/api/student/:rollNumber', async (req, res) => {
  try {
    const rollNumber = req.params.rollNumber;
    const schoolCode = req.query.school_code;
    
    console.log(`Request received - Roll Number: ${rollNumber}, School Code: ${schoolCode}`);
    
    // Validate inputs
    if (!rollNumber || !schoolCode) {
      console.log('Missing required parameters');
      return res.status(400).json({
        success: false,
        message: 'Both admission number and school code are required'
      });
    }
    
    // Load sheet
    const doc = await loadSheet();
    
    // Assuming first sheet contains student data
    const sheet = doc.sheetsByIndex[0];
    const rows = await sheet.getRows();
    
    console.log(`Total rows in sheet: ${rows.length}`);
    
    // First check if the School_Code column exists
    const firstRow = rows[0];
    const hasSchoolCodeColumn = firstRow && 'School_Code' in firstRow;
    
    if (!hasSchoolCodeColumn) {
      console.log('School_Code column not found in the sheet');
      return res.status(500).json({
        success: false,
        message: 'Configuration error: School_Code column not found in data'
      });
    }
    
    // Log a few row examples to debug
    for (let i = 0; i < Math.min(3, rows.length); i++) {
      console.log(`Row ${i} - Roll_Number: ${rows[i].Roll_Number}, School_Code: ${rows[i].School_Code}`);
    }
    
    // Find student with matching roll number
    const student = rows.find(row => row.Roll_Number === rollNumber);
    
    if (!student) {
      console.log('Student not found with roll number:', rollNumber);
      return res.status(404).json({
        success: false,
        message: 'Student not found. Please check admission number and try again.'
      });
    }
    
    // Check if school code matches
    const studentSchoolCode = student.School_Code || '';
    console.log(`Student found. Comparing School Codes - Expected: ${studentSchoolCode}, Provided: ${schoolCode}`);
    
    if (studentSchoolCode.toString().trim() !== schoolCode.toString().trim()) {
      console.log('School code mismatch');
      return res.status(403).json({
        success: false,
        message: 'Invalid school code for this student.'
      });
    }
    
    console.log('School code validated successfully');
    
    // Process student data (similar to your existing code)
    // This is a basic example - modify according to your actual data structure
    const subjects = [];
    
    // Process all columns to find subject data
    for (const [key, value] of Object.entries(student)) {
      // If column name contains subject info (add your logic here)
      if (key.includes('_Obtained') || key.includes('_Max_Marks')) {
        subjects.push({
          name: key,
          obtained: parseInt(value) || 0
        });
      }
    }
    
    // Calculate total obtained marks, percentage, etc.
    const totalObtained = calculateTotalMarks(subjects);
    const totalMarks = 100; // or calculate from your data
    const percentage = ((totalObtained / totalMarks) * 100).toFixed(2);
    
    // Prepare student data to return
    const studentData = {
      name: student.Name,
      class: student.Class,
      school: student.School_Name,
      examName: student.Exam_Name || 'Examination',
      dob: student.DOB,
      fatherName: student.Father_Name,
      motherName: student.Mother_Name,
      subjects: subjects,
      totalObtained: totalObtained,
      totalMarks: totalMarks,
      percentage: percentage,
      cgpa: calculateCGPA(percentage),
      result: totalObtained >= 33 ? 'PASS' : 'FAIL'
    };
    
    return res.json({
      success: true,
      data: studentData
    });
    
  } catch (error) {
    console.error('Error fetching student data:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while fetching student data'
    });
  }
});

// Helper function to calculate total marks
function calculateTotalMarks(subjects) {
  // Get unique base subjects (e.g., "Hindi" from "Hindi_Periodic_Test_Obtained")
  const baseSubjects = new Set();
  subjects.forEach(subject => {
    if (subject.name.includes('_')) {
      const baseSubject = subject.name.split('_')[0];
      baseSubjects.add(baseSubject);
    }
  });
  
  // Calculate total for each subject
  let totalMarks = 0;
  baseSubjects.forEach(baseSubject => {
    const subjectComponents = subjects.filter(subject => 
      subject.name.startsWith(baseSubject + '_') && 
      subject.name.includes('_Obtained')
    );
    
    const subjectTotal = subjectComponents.reduce((sum, component) => sum + component.obtained, 0);
    totalMarks += subjectTotal;
  });
  
  return totalMarks;
}

// Helper function to calculate CGPA
function calculateCGPA(percentage) {
  // Implement your CGPA calculation logic here
  // This is a simple example
  if (percentage >= 90) return 'A+';
  if (percentage >= 80) return 'A';
  if (percentage >= 70) return 'B+';
  if (percentage >= 60) return 'B';
  if (percentage >= 50) return 'C';
  if (percentage >= 33) return 'D';
  return 'F';
}

// Add a test endpoint to check if School_Code column exists
app.get('/api/test-school-code', async (req, res) => {
  try {
    const doc = await loadSheet();
    const sheet = doc.sheetsByIndex[0];
    const rows = await sheet.getRows();
    
    if (rows.length === 0) {
      return res.json({
        success: false,
        message: 'No data found in sheet'
      });
    }
    
    const firstRow = rows[0];
    const columns = Object.keys(firstRow);
    
    return res.json({
      success: true,
      hasSchoolCodeColumn: columns.includes('School_Code'),
      columnNames: columns,
      sampleData: {
        firstRow: Object.fromEntries(
          Object.entries(firstRow).slice(0, 10) // First 10 columns only
        )
      }
    });
  } catch (error) {
    console.error('Error testing school code:', error);
    return res.status(500).json({
      success: false,
      message: 'Error testing school code column',
      error: error.message
    });
  }
});

// Start server
app.listen(port, () => {
  console.log(`Server running on port ${port}`);
});
