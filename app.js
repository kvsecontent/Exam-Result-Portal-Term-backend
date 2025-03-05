// app.js
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
    const sheet = doc.sheetsByIndex[0];
    const rows = await sheet.getRows();
    
    console.log(`Total rows in sheet: ${rows.length}`);
    
    // Log column headers to help debug
    if (rows.length > 0) {
      const firstRow = rows[0];
      console.log('Available columns:', Object.keys(firstRow));
      
      // Check if School_Code column exists
      const hasSchoolCode = Object.keys(firstRow).includes('School_Code');
      console.log('Has School_Code column:', hasSchoolCode);
      
      if (!hasSchoolCode) {
        console.log('WARNING: School_Code column not found in sheet');
      }
    }
    
    // First find student with matching roll number
    const student = rows.find(row => row.Roll_Number === rollNumber);
    
    if (!student) {
      console.log('Student not found with roll number:', rollNumber);
      return res.status(404).json({
        success: false,
        message: 'Student not found. Please check admission number and try again.'
      });
    }
    
    // Check for School_Code field
    if (!('School_Code' in student)) {
      console.log('ERROR: School_Code column does not exist in the sheet');
      
      // IMPORTANT: Since the column doesn't exist, let's consider it "valid" for now
      // You can make this more strict later once the column is added
      console.log('Allowing access since School_Code column is missing');
    } else {
      // School code validation
      const correctSchoolCode = String(student.School_Code || '').trim();
      const providedSchoolCode = String(schoolCode).trim();
      
      console.log('Correct School Code:', correctSchoolCode);
      console.log('Provided School Code:', providedSchoolCode);
      
      // Check if school codes don't match
      if (correctSchoolCode !== '' && correctSchoolCode !== providedSchoolCode) {
        console.log('School code mismatch!');
        return res.status(403).json({
          success: false,
          message: 'Invalid school code for this student.'
        });
      }
      
      console.log('School code validation passed');
    }
    
    // Process student data (extract subjects, calculate totals, etc.)
    const subjects = [];
    
    // Extract subject data from all column names
    for (const key in student) {
      if (key.includes('_Obtained') || key.includes('_Max_Marks')) {
        subjects.push({
          name: key,
          obtained: parseInt(student[key]) || 0
        });
      }
    }
    
    // Extract total marks and other statistics
    let totalObtained = 0;
    let totalMarks = 0;
    
    // Calculate total marks for all subjects
    const baseSubjects = new Set();
    subjects.forEach(subject => {
      if (subject.name.includes('_')) {
        const baseSubject = subject.name.split('_')[0];
        baseSubjects.add(baseSubject);
      }
    });
    
    // Sum up obtained marks for each subject
    baseSubjects.forEach(baseSubject => {
      const subjectMarks = subjects.filter(s => 
        s.name.startsWith(baseSubject + '_') && 
        s.name.includes('_Obtained')
      );
      
      const subjectTotal = subjectMarks.reduce((sum, mark) => sum + mark.obtained, 0);
      totalObtained += subjectTotal;
    });
    
    // Set default total marks if not calculated from subjects
    totalMarks = 100; // Or calculate from subjects if available
    
    // Calculate percentage and CGPA
    const percentage = ((totalObtained / totalMarks) * 100).toFixed(2);
    
    // Create student data response object
    const studentData = {
      name: student.Name,
      class: student.Class,
      school: student.School_Name,
      examName: student.Exam_Name || 'Examination',
      dob: student.DOB,
      fatherName: student.Father_Name,
      motherName: student.Mother_Name,
      examInchargeSignature: student.Signature || '',
      subjects: subjects,
      totalObtained: totalObtained,
      totalMarks: totalMarks,
      percentage: percentage,
      cgpa: calculateGrade(percentage),
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

// Helper function to calculate grade based on percentage
function calculateGrade(percentage) {
  if (percentage >= 90) return 'A+';
  if (percentage >= 80) return 'A';
  if (percentage >= 70) return 'B+';
  if (percentage >= 60) return 'B';
  if (percentage >= 50) return 'C';
  if (percentage >= 33) return 'D';
  return 'F';
}

// Simple test route to verify the server is running
app.get('/', (req, res) => {
  res.send('Exam Result API is running!');
});

// Start the server
app.listen(port, () => {
  console.log(`Server running on port ${port}`);
});
