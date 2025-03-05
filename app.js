// server.js or app.js for Render
const express = require('express');
const { GoogleSpreadsheet } = require('google-spreadsheet');
const cors = require('cors');
const app = express();
const port = process.env.PORT || 3000;

// Middleware
app.use(express.json());
app.use(cors());

// Error handler middleware - prevents code from being exposed
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ 
    success: false, 
    message: 'Internal server error' 
  });
});

// Google Sheet API credentials
const SPREADSHEET_ID = process.env.SPREADSHEET_ID;
const GOOGLE_SERVICE_ACCOUNT_EMAIL = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
const GOOGLE_PRIVATE_KEY = process.env.GOOGLE_PRIVATE_KEY.replace(/\\n/g, '\n');

// Connect to Google Sheet
async function loadSheet() {
  try {
    const doc = new GoogleSpreadsheet(SPREADSHEET_ID);
    
    await doc.useServiceAccountAuth({
      client_email: GOOGLE_SERVICE_ACCOUNT_EMAIL,
      private_key: GOOGLE_PRIVATE_KEY,
    });
    
    await doc.loadInfo();
    return doc;
  } catch (error) {
    console.error('Error loading sheet:', error);
    throw new Error('Unable to connect to database');
  }
}

// API endpoint to get student result
app.get('/api/student/:rollNumber', async (req, res) => {
  try {
    const rollNumber = req.params.rollNumber;
    const schoolCode = req.query.school_code;
    
    // Input validation
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
    
    // Find student with matching roll number AND school code
    let student = null;
    
    for (const row of rows) {
      // Convert to strings and trim for consistent comparison
      const rowRollNumber = String(row.Roll_Number || '').trim();
      const rowSchoolCode = String(row.School_Code || '').trim();
      const requestRollNumber = String(rollNumber).trim();
      const requestSchoolCode = String(schoolCode).trim();
      
      if (rowRollNumber === requestRollNumber && rowSchoolCode === requestSchoolCode) {
        student = row;
        break;
      }
    }
    
    if (!student) {
      return res.status(404).json({
        success: false,
        message: 'Student not found. Please check admission number and school code.'
      });
    }
    
    // Process student data
    const subjects = [];
    
    // Extract subject data from the row
    Object.entries(student).forEach(([key, value]) => {
      if (value && (key.includes('_Obtained') || key.includes('_Max_Marks'))) {
        subjects.push({
          name: key,
          obtained: parseInt(value) || 0
        });
      }
    });
    
    // Calculate total obtained marks
    const totalObtained = calculateTotalMarks(subjects);
    const totalMarks = 100; // Adjust as needed
    const percentage = ((totalObtained / totalMarks) * 100).toFixed(2);
    
    // Prepare student data response
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
    console.error('Error processing request:', error);
    return res.status(500).json({
      success: false,
      message: 'Server error while fetching student data'
    });
  }
});

// Helper function to calculate total marks
function calculateTotalMarks(subjects) {
  // Get unique base subjects
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
  if (percentage >= 90) return 'A+';
  if (percentage >= 80) return 'A';
  if (percentage >= 70) return 'B+';
  if (percentage >= 60) return 'B';
  if (percentage >= 50) return 'C';
  if (percentage >= 33) return 'D';
  return 'F';
}

// Default route - provide a simple response for the root path
app.get('/', (req, res) => {
  res.send('Exam Results API is running. Use /api/student/:rollNumber?school_code=XXX to access student data.');
});

// Start server
app.listen(port, () => {
  console.log(`Server running on port ${port}`);
});
