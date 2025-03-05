// app.js
const express = require('express');
const cors = require('cors');
const app = express();
const port = process.env.PORT || 3000;

// Middleware
app.use(express.json());
app.use(cors());

// Basic route to verify server is running
app.get('/', (req, res) => {
  res.send('Exam Result API is running! Environment check: ' + 
    (process.env.SPREADSHEET_ID ? 'SPREADSHEET_ID ✓' : 'SPREADSHEET_ID ✗') + ', ' + 
    (process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL ? 'GOOGLE_SERVICE_ACCOUNT_EMAIL ✓' : 'GOOGLE_SERVICE_ACCOUNT_EMAIL ✗') + ', ' + 
    (process.env.GOOGLE_PRIVATE_KEY ? 'GOOGLE_PRIVATE_KEY ✓' : 'GOOGLE_PRIVATE_KEY ✗'));
});

// Initial error handling for Google Spreadsheet connection
let googleSpreadsheet;
try {
  // Only require the module if it's available
  googleSpreadsheet = require('google-spreadsheet');
  console.log('Successfully loaded google-spreadsheet module');
} catch (error) {
  console.error('Error loading google-spreadsheet module:', error.message);
}

// Connect to Google Sheet with error handling
async function loadSheet() {
  try {
    if (!googleSpreadsheet) {
      throw new Error('google-spreadsheet module not available');
    }
    
    const { GoogleSpreadsheet } = googleSpreadsheet;
    
    // Check if environment variables are available
    if (!process.env.SPREADSHEET_ID) {
      throw new Error('SPREADSHEET_ID environment variable is missing');
    }
    
    if (!process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL) {
      throw new Error('GOOGLE_SERVICE_ACCOUNT_EMAIL environment variable is missing');
    }
    
    if (!process.env.GOOGLE_PRIVATE_KEY) {
      throw new Error('GOOGLE_PRIVATE_KEY environment variable is missing');
    }
    
    const doc = new GoogleSpreadsheet(process.env.SPREADSHEET_ID);
    
    await doc.useServiceAccountAuth({
      client_email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
      private_key: process.env.GOOGLE_PRIVATE_KEY.replace(/\\n/g, '\n'),
    });
    
    await doc.loadInfo();
    return doc;
  } catch (error) {
    console.error('Error loading Google Sheet:', error.message);
    throw error;
  }
}

// API endpoint with better error handling
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
    
    // Safely load the sheet
    let doc;
    try {
      doc = await loadSheet();
    } catch (error) {
      console.error('Failed to load sheet:', error.message);
      return res.status(500).json({
        success: false,
        message: 'Server error: Could not access student data'
      });
    }
    
    // Get the first sheet
    const sheet = doc.sheetsByIndex[0];
    const rows = await sheet.getRows();
    
    console.log(`Total rows in sheet: ${rows.length}`);
    
    // Log the first row to see column headers
    if (rows.length > 0) {
      console.log('Available columns:', Object.keys(rows[0]));
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
    
    console.log('Student found:', student.Name);
    
    // Check for School_Code field
    if (!('School_Code' in student)) {
      console.log('WARNING: School_Code column exists but not in this student record');
    } else {
      // School code validation
      const correctSchoolCode = String(student.School_Code || '').trim();
      const providedSchoolCode = String(schoolCode).trim();
      
      console.log('Correct School Code:', correctSchoolCode);
      console.log('Provided School Code:', providedSchoolCode);
      
      // Check if valid school code is in sheet and doesn't match
      if (correctSchoolCode !== '' && correctSchoolCode !== providedSchoolCode) {
        console.log('School code mismatch!');
        return res.status(403).json({
          success: false,
          message: 'Invalid school code for this student.'
        });
      }
      
      console.log('School code validation passed');
    }
    
    // Process student data
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
    console.error('Unhandled error in route handler:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while fetching student data',
      error: error.message
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

// Make process errors visible
process.on('uncaughtException', (error) => {
  console.error('Uncaught Exception:', error);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
});

// Start the server with error handling
app.listen(port, () => {
  console.log(`Server running on port ${port}`);
}).on('error', (error) => {
  console.error('Error starting server:', error.message);
});
