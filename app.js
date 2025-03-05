// app.js
const express = require('express');
const { GoogleSpreadsheet } = require('google-spreadsheet');
const cors = require('cors');
const app = express();
const port = process.env.PORT || 3000;

// Middleware
app.use(express.json());
app.use(cors());

// Get environment variables
let SPREADSHEET_ID = process.env.SPREADSHEET_ID;
let GOOGLE_SERVICE_ACCOUNT_EMAIL = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
let GOOGLE_PRIVATE_KEY = process.env.GOOGLE_PRIVATE_KEY;

// Log environment variable presence
console.log('Environment variable check:');
console.log('- SPREADSHEET_ID present:', !!SPREADSHEET_ID);
console.log('- GOOGLE_SERVICE_ACCOUNT_EMAIL present:', !!GOOGLE_SERVICE_ACCOUNT_EMAIL);
console.log('- GOOGLE_PRIVATE_KEY present:', !!GOOGLE_PRIVATE_KEY);

// Use default values if missing (for development only)
if (!SPREADSHEET_ID) {
  console.warn('WARNING: Using default SPREADSHEET_ID');
  SPREADSHEET_ID = '116NbAamZahJdmH04jV4ZahzedoW6eliZqKl0Q6tLvv4';
}

if (!GOOGLE_SERVICE_ACCOUNT_EMAIL) {
  console.warn('WARNING: Using default GOOGLE_SERVICE_ACCOUNT_EMAIL');
  GOOGLE_SERVICE_ACCOUNT_EMAIL = 'term-exam-results-service@gen-lang-client-0184615441.iam.gserviceaccount.com';
}

// IMPORTANT: Fix the OpenSSL error by using a hardcoded key for now
// This is a temporary solution to get around the environment variable formatting issues
const hardcodedKey = `-----BEGIN PRIVATE KEY-----
MIIEvAIBADANBgkqhkiG9w0BAQEFAASCBKYwggSiAgEAAoIBAQCu00ZKTo6YS5IO
tEun4KF7KCjFb3oGQcxXgYbhSYZCmwc0bdNnXRo6tcgtcTZqYmhn165ks4rtnTRi
/dLnzYAfv87wXPEp3M3LRTnTu2Z1cMAY84rjeSvibKWdoqHVM6qzQgJgmZh5O9co
JsdfempahzyyOURSECRETKEYFORPRIVACY7w5wsOw5/t0V+hEQBLfHE5LsriWQkMdRc5uh2xnuQGTAwFeWUGK
togeIksk1WRHWJpgJY5EcXWcqpMKV9ijJhJvEdbIwGY9Y7UAgRBEtF9GrxjQ617i
i0gji42z41+l2F2LKi8sg+kvathIMUUCqLmrWK8Em5RDutQsudNtQlUa0K7/zuzX
UfoCpFyhAgMBAAECggEADkArl81dLfM5tdgi3fg0wY4YULZnEHvW6n/PnQKkyT4g
3A24cKcJXHrKlVBdWquojg+/PUyDXnN05z2Ag85ftiF+VAqHdV2fKtrQPWmmZEar
af1EN4mo4Z1F8hplLbS3TUMWtYV1BSuIZ334Z4MviISYlzMb1+t/5HuXJuMu4Y03
+8myl4sPXCLqIg85kfAOWJNCr4RD9M5Ss10TH5CL8ij9m19MA27WGznv4R6W3ZFm
JtZ+Zi8c5uLlgYUTQdteW0Jmf8TzUbq5EDZ4rAP0H0tKlkibKxYaiE6RloDB3/ZU
P8X2jddMqj2+Ytoi5O5z8px1tYFAYdlHKIkQ2gjKRwKBgQD1xqIzEDUy7iE6DrJx
ZKr9JCd06PWALtX81h/akU46p1zLOAmuv7UI1AULWoW2uru7Lt66YumJ0TFW4Vho
vZOHFHwrLX0urVaEcM96btWpryIbYxm25IaysJGr8Gj3dBphicX+YPRyhbcPIEgb
DJ2m1lQKWbg8P2OkJ5TCVH0N0wKBgQC2GQ8va10dzadaG6IBRUzyWDOGUUYuGIV9
BvV9Ub349YwYxlyZaGla8EQDTmGXvKwobsLGsA2rK8k3g1fYh0PAOBUKlUGEOiZq
BoqeWFBCqnoDrRRPuL9g3LmgRUrX323IUfznkAsQT5dkyZaABEqddJ/ERlMh6ae0
Gf4NMZ//OwKBgGMI70L0PPuQyQLD+VOH5P6sGtoZJRPJy6BeB+fitUsdNV8N7Zjk
1uX/ySiSCV9gT1VVxZoFUWWfTepcU2uhOFkt//rGEbNFVZ94daI4FxCQ6YVvoWT5
IO3QCGLoNOPBfP/grE+ccePTzbfioiuEIeKgaqzhCkP8pwH2kRLdSKbRAoGAWzEp
fgtdrT6SnmkaiduBExHCRETKEYaHSu/4ldOaptuExq5uoEffZoXP+RaKahevNq0OsqSuNa/Xx7Oyt4sn57bc6r/Tn
7gB0l+gRmI9aCsGSmEx9nRMqAEHuwuILwUiQyRH+kKC4r0Ph82wWOcD5vinSHKOS
d5SXNc/mDT82810y0K964xwkvbL5nSP3KjxT18kCgYBRipYA/asRUCugrRKxzfqW
kNG8FukUkHucix4l3Z5TfnCp8gaCu310DvjE0pVFhOtBYvtnTLYqXunLp65aILhO
dD6kkJPLchQYBs4nOPavofB0rsHgyh8IDVHv6JDzrEu6lYQ/Arym2QToC1T+ZRa9
vbRWELYyvVIjwlFV2gUpZw==
-----END PRIVATE KEY-----`;

// Sheet configuration - use GID from the URL
const TARGET_GID = 1921076835; // From your URL

// Connect to Google Sheet - with FIXED PRIVATE KEY APPROACH
async function loadSheet() {
  try {
    console.log('Connecting to Google Sheet...');
    console.log(`Using Spreadsheet ID: ${SPREADSHEET_ID}`);
    console.log(`Using Service Account: ${GOOGLE_SERVICE_ACCOUNT_EMAIL}`);
    
    const doc = new GoogleSpreadsheet(SPREADSHEET_ID);
    
    // IMPORTANT: Try multiple approaches to authenticate
    let authSuccess = false;
    
    // Approach 1: Try with environment variable private key
    try {
      console.log('Trying authentication with environment variable private key...');
      let processedKey = GOOGLE_PRIVATE_KEY;
      
      // Process the key to handle different formats
      if (processedKey && !processedKey.includes('-----BEGIN PRIVATE KEY-----')) {
        console.log('Key format needs processing...');
        // Try replacing escaped newlines
        processedKey = processedKey.replace(/\\n/g, '\n');
      }
      
      await doc.useServiceAccountAuth({
        client_email: GOOGLE_SERVICE_ACCOUNT_EMAIL,
        private_key: processedKey
      });
      
      console.log('Authentication successful with environment variable key!');
      authSuccess = true;
    } catch (error) {
      console.log('Authentication with environment variable key failed:', error.message);
    }
    
    // Approach 2: Try with hardcoded key (temporary solution)
    if (!authSuccess) {
      try {
        console.log('Trying authentication with hardcoded key...');
        await doc.useServiceAccountAuth({
          client_email: GOOGLE_SERVICE_ACCOUNT_EMAIL,
          private_key: hardcodedKey
        });
        
        console.log('Authentication successful with hardcoded key!');
        authSuccess = true;
      } catch (error) {
        console.log('Authentication with hardcoded key failed:', error.message);
      }
    }
    
    // If all authentication methods failed
    if (!authSuccess) {
      throw new Error('All authentication methods failed');
    }
    
    await doc.loadInfo();
    console.log(`Spreadsheet loaded: "${doc.title}" with ${doc.sheetCount} sheets`);
    
    // List all available sheets for debugging
    doc.sheetsByIndex.forEach((sheet, index) => {
      console.log(`Sheet ${index}: "${sheet.title}" (GID: ${sheet.sheetId})`);
    });
    
    return doc;
  } catch (error) {
    console.error('Error connecting to Google Sheet:', error);
    throw new Error(`Failed to connect to Google Sheet: ${error.message}`);
  }
}

// Find the target sheet by GID
async function getTargetSheet(doc) {
  // Find sheet by GID
  let targetSheet = null;
  
  for (const sheet of doc.sheetsByIndex) {
    console.log(`Checking sheet: ${sheet.title}, GID: ${sheet.sheetId}`);
    if (sheet.sheetId === TARGET_GID) {
      targetSheet = sheet;
      console.log(`Found matching sheet by GID: ${sheet.title}`);
      break;
    }
  }
  
  // If not found by GID, fallback to index 1 (Sheet2)
  if (!targetSheet) {
    console.log('Sheet not found by GID, trying index 1 (Sheet2)');
    targetSheet = doc.sheetsByIndex[1];
    
    // If still not found, try sheet named "Sheet2"
    if (!targetSheet) {
      console.log('Sheet not found by index, trying by name "Sheet2"');
      targetSheet = doc.sheetsByTitle['Sheet2'];
      
      // Last resort: use the first sheet
      if (!targetSheet) {
        console.log('Using first sheet as fallback');
        targetSheet = doc.sheetsByIndex[0];
      }
    }
  }
  
  if (!targetSheet) {
    throw new Error('Could not find any sheet in the spreadsheet');
  }
  
  console.log(`Using sheet: "${targetSheet.title}" (rows: ${targetSheet.rowCount})`);
  return targetSheet;
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
    
    // Get the target sheet
    const targetSheet = await getTargetSheet(doc);
    
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
  console.log(`Target GID: ${TARGET_GID}`);
});
