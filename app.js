// app.js
const express = require('express');
const { GoogleSpreadsheet } = require('google-spreadsheet');
const cors = require('cors');
const app = express();
const port = process.env.PORT || 3000;

// Middleware
app.use(express.json());
app.use(cors());

// Check for required environment variables
if (!process.env.SPREADSHEET_ID || !process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL || !process.env.GOOGLE_PRIVATE_KEY) {
  console.error('Missing required environment variables. Please set SPREADSHEET_ID, GOOGLE_SERVICE_ACCOUNT_EMAIL, and GOOGLE_PRIVATE_KEY.');
}

// Google Sheet API credentials
const SPREADSHEET_ID = process.env.SPREADSHEET_ID; // Your Google Sheet ID
const GOOGLE_SERVICE_ACCOUNT_EMAIL = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
const GOOGLE_PRIVATE_KEY = process.env.GOOGLE_PRIVATE_KEY.replace(/\\n/g, '\n');

// Sheet configuration
const SHEET_NAME = "Sheet2"; // Change this to match your exact sheet name

// Connect to Google Sheet
async function loadSheet() {
  try {
    console.log('Connecting to Google Sheet...');
    const doc = new GoogleSpreadsheet(SPREADSHEET_ID);
    
    await doc.useServiceAccountAuth({
      client_email: GOOGLE_SERVICE_ACCOUNT_EMAIL,
      private_key: GOOGLE_PRIVATE_KEY,
    });
    
    await doc.loadInfo();
    console.log(`Spreadsheet loaded: "${doc.title}" with ${doc.sheetCount} sheets`);
    
    // List all available sheets for debugging
    const sheetNames = doc.sheetsByIndex.map(sheet => sheet.title);
    console.log('Available sheets:', sheetNames);
    
    return doc;
  } catch (error) {
    console.error('Error connecting to Google Sheet:', error);
    throw new Error('Failed to connect to Google Sheet. Check your credentials.');
  }
}

// API endpoint to get student result by roll number and school code
app.get('/api/student/:rollNumber', async (req, res) => {
  try {
    console.log('Request received for roll number:', req.params.rollNumber);
    
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
    
    // Get the sheet by name (preferred method)
    let targetSheet = doc.sheetsByTitle[SHEET_NAME];
    
    // If sheet not found by name, try index 1 (Sheet2) as fallback
    if (!targetSheet) {
      console.log(`Sheet "${SHEET_NAME}" not found by name, trying index 1 as fallback`);
      targetSheet = doc.sheetsByIndex[1];
      
      if (!targetSheet) {
        console.error('Failed to find the target sheet by name or index');
        return res.status(500).json({
          success: false,
          message: 'Server configuration error: Target sheet not found'
        });
      }
    }
    
    console.log(`Using sheet: "${targetSheet.title}" (rowCount: ${targetSheet.rowCount})`);
    const rows = await targetSheet.getRows();
    console.log(`Loaded ${rows.length} rows from sheet`);
    
    console.log(`Looking for student with roll number: ${rollNumber} and school code: ${schoolCode}`);
    
    // First find student with matching roll number
    const student = rows.find(row => row.Roll_Number === rollNumber);
    
    if (!student) {
      console.log(`Student with roll number ${rollNumber} not found`);
      return res.status(404).json({
        success: false,
        message: 'Student not found. Please check admission number and try again.'
      });
    }
    
    console.log('Found student:', student.Name);
    console.log('Student School Code:', student.School_Code);
    console.log('Provided School Code:', schoolCode);
    
    // IMPORTANT: Strictly validate school code
    // Check if school code matches - convert both to strings, trim whitespace
    const correctSchoolCode = String(student.School_Code || '').trim();
    const providedSchoolCode = String(schoolCode).trim();
    
    if (correctSchoolCode !== providedSchoolCode) {
      console.log('School code mismatch!');
      return res.status(403).json({
        success: false,
        message: 'Invalid school code for this student.'
      });
    }
    
    console.log('School code validation successful!');
    
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
      
      // Count the number of subjects to calculate total marks
      totalMarks += 100; // Assuming each subject is out of 100
    });
    
    // Calculate percentage and CGPA
    const percentage = ((totalObtained / totalMarks) * 100).toFixed(2);
    
    // Determine passing result (33% is passing)
    const passingPercentage = 33;
    const result = parseFloat(percentage) >= passingPercentage ? 'PASS' : 'FAIL';
    
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
      result: result
    };
    
    console.log(`Successfully processed result for ${student.Name}`);
    
    return res.json({
      success: true,
      data: studentData
    });
    
  } catch (error) {
    console.error('Error fetching student data:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while fetching student data',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// Helper function to calculate grade based on percentage
function calculateGrade(percentage) {
  const percent = parseFloat(percentage);
  if (percent >= 90) return 'A+';
  if (percent >= 80) return 'A';
  if (percent >= 70) return 'B+';
  if (percent >= 60) return 'B';
  if (percent >= 50) return 'C';
  if (percent >= 33) return 'D';
  return 'F';
}

// Simple test route to verify the server is running
app.get('/', (req, res) => {
  res.send('Exam Result API is running! Dual validation is enabled.');
});

// Handle all other routes
app.use('*', (req, res) => {
  res.status(404).send('Route not found');
});

// Start the server
app.listen(port, () => {
  console.log(`Server running on port ${port}`);
  console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log(`Target sheet: "${SHEET_NAME}"`);
});
