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
    
    // Validate inputs
    if (!rollNumber || !schoolCode) {
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
    
    // Find student with matching roll number AND school code
    const student = rows.find(row => 
      row.Roll_Number === rollNumber && 
      row.School_Code === schoolCode
    );
    
    if (!student) {
      return res.status(404).json({
        success: false,
        message: 'Student not found. Please check admission number and school code.'
      });
    }
    
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

// Start server
app.listen(port, () => {
  console.log(`Server running on port ${port}`);
});
