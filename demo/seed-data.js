const mongoose = require('mongoose');
const User = require('../backend/models/User');
const Case = require('../backend/models/Case');
const logger = require('../backend/utils/logger');

// Demo users data
const demoUsers = [
  // Admin
  {
    email: 'admin@panchtatva.in',
    role: 'admin',
    isActive: true,
    isVerified: true,
    adminProfile: {
      name: 'System Administrator',
      phone: '+91-9876543210',
      department: 'IT Administration',
      permissions: ['user_management', 'case_management', 'system_config', 'audit_logs', 'reports']
    }
  },
  
  // Judges
  {
    email: 'judge.sharma@court.gov.in',
    role: 'judge',
    isActive: true,
    isVerified: true,
    judgeProfile: {
      name: 'Hon\'ble Justice Rajesh Sharma',
      phone: '+91-9876543211',
      specializationTags: ['criminal', 'constitutional'],
      seniorityLevel: 'chief',
      maxDailyIntake: 8,
      currentDailyLoad: 0,
      conflicts: [],
      rating: 4.8,
      courtAssignment: 'Delhi High Court',
      jurisdictions: ['Delhi', 'NCR'],
      languages: ['en', 'hi']
    }
  },
  {
    email: 'judge.patel@court.gov.in',
    role: 'judge',
    isActive: true,
    isVerified: true,
    judgeProfile: {
      name: 'Hon\'ble Justice Priya Patel',
      phone: '+91-9876543212',
      specializationTags: ['civil', 'family'],
      seniorityLevel: 'senior',
      maxDailyIntake: 6,
      currentDailyLoad: 0,
      conflicts: [],
      rating: 4.6,
      courtAssignment: 'Mumbai High Court',
      jurisdictions: ['Maharashtra', 'Mumbai'],
      languages: ['en', 'hi', 'mr']
    }
  },
  {
    email: 'judge.kumar@court.gov.in',
    role: 'judge',
    isActive: true,
    isVerified: true,
    judgeProfile: {
      name: 'Hon\'ble Justice Anand Kumar',
      phone: '+91-9876543213',
      specializationTags: ['cyber', 'corporate'],
      seniorityLevel: 'junior',
      maxDailyIntake: 5,
      currentDailyLoad: 0,
      conflicts: [],
      rating: 4.2,
      courtAssignment: 'Bangalore High Court',
      jurisdictions: ['Karnataka', 'Bangalore'],
      languages: ['en', 'kn']
    }
  },
  
  // Lawyers
  {
    email: 'advocate.singh@lawfirm.com',
    role: 'lawyer',
    isActive: true,
    isVerified: true,
    lawyerProfile: {
      name: 'Adv. Vikram Singh',
      phone: '+91-9876543214',
      practiceAreas: ['criminal', 'constitutional'],
      yearsOfExperience: 15,
      barId: 'D/1234/2008',
      maxConcurrentCases: 12,
      currentCaseLoad: 0,
      conflicts: [],
      rating: 4.7,
      specializations: ['IPC', 'CrPC', 'POCSO'],
      languages: ['en', 'hi'],
      courtPreferences: ['Delhi High Court', 'Supreme Court']
    }
  },
  {
    email: 'advocate.reddy@lawfirm.com',
    role: 'lawyer',
    isActive: true,
    isVerified: true,
    lawyerProfile: {
      name: 'Adv. Lakshmi Reddy',
      phone: '+91-9876543215',
      practiceAreas: ['civil', 'family'],
      yearsOfExperience: 12,
      barId: 'M/5678/2011',
      maxConcurrentCases: 10,
      currentCaseLoad: 0,
      conflicts: [],
      rating: 4.5,
      specializations: ['Property Law', 'Matrimonial'],
      languages: ['en', 'te', 'hi'],
      courtPreferences: ['Mumbai High Court', 'Family Courts']
    }
  },
  {
    email: 'advocate.gupta@techlaw.in',
    role: 'lawyer',
    isActive: true,
    isVerified: true,
    lawyerProfile: {
      name: 'Adv. Rohit Gupta',
      phone: '+91-9876543216',
      practiceAreas: ['cyber', 'corporate'],
      yearsOfExperience: 8,
      barId: 'B/9012/2015',
      maxConcurrentCases: 15,
      currentCaseLoad: 0,
      conflicts: [],
      rating: 4.3,
      specializations: ['IT Act', 'Data Protection', 'Corporate Law'],
      languages: ['en', 'hi'],
      courtPreferences: ['Bangalore High Court', 'Cyber Crime Courts']
    }
  },
  {
    email: 'advocate.iyer@seniorcounsel.in',
    role: 'lawyer',
    isActive: true,
    isVerified: true,
    lawyerProfile: {
      name: 'Adv. Sundar Iyer',
      phone: '+91-9876543217',
      practiceAreas: ['constitutional', 'civil'],
      yearsOfExperience: 25,
      barId: 'C/3456/1998',
      maxConcurrentCases: 8,
      currentCaseLoad: 0,
      conflicts: [],
      rating: 4.9,
      specializations: ['Constitutional Law', 'PIL', 'Supreme Court Practice'],
      languages: ['en', 'ta', 'hi'],
      courtPreferences: ['Supreme Court', 'Chennai High Court']
    }
  },
  {
    email: 'advocate.khan@criminallaw.in',
    role: 'lawyer',
    isActive: true,
    isVerified: true,
    lawyerProfile: {
      name: 'Adv. Farah Khan',
      phone: '+91-9876543218',
      practiceAreas: ['criminal', 'family'],
      yearsOfExperience: 10,
      barId: 'D/7890/2013',
      maxConcurrentCases: 12,
      currentCaseLoad: 0,
      conflicts: [],
      rating: 4.4,
      specializations: ['Women & Child Protection', 'Domestic Violence'],
      languages: ['en', 'hi', 'ur'],
      courtPreferences: ['Delhi High Court', 'Sessions Courts']
    }
  },
  {
    email: 'advocate.nair@corporatelaw.in',
    role: 'lawyer',
    isActive: true,
    isVerified: true,
    lawyerProfile: {
      name: 'Adv. Arjun Nair',
      phone: '+91-9876543219',
      practiceAreas: ['corporate', 'civil'],
      yearsOfExperience: 18,
      barId: 'M/2468/2005',
      maxConcurrentCases: 10,
      currentCaseLoad: 0,
      conflicts: [],
      rating: 4.6,
      specializations: ['M&A', 'Securities Law', 'Commercial Disputes'],
      languages: ['en', 'ml', 'hi'],
      courtPreferences: ['Mumbai High Court', 'NCLT']
    }
  },
  
  // Clients
  {
    email: 'ramesh.client@gmail.com',
    role: 'client',
    isActive: true,
    isVerified: true,
    clientProfile: {
      name: 'Ramesh Kumar',
      phone: '+91-9876543220',
      region: 'Delhi',
      consentToDataPolicy: true,
      preferredLanguage: 'hi'
    }
  },
  {
    email: 'priya.client@gmail.com',
    role: 'client',
    isActive: true,
    isVerified: true,
    clientProfile: {
      name: 'Priya Sharma',
      phone: '+91-9876543221',
      region: 'Mumbai',
      consentToDataPolicy: true,
      preferredLanguage: 'en'
    }
  },
  {
    email: 'tech.startup@company.com',
    role: 'client',
    isActive: true,
    isVerified: true,
    clientProfile: {
      name: 'TechCorp Solutions',
      phone: '+91-9876543222',
      region: 'Bangalore',
      consentToDataPolicy: true,
      preferredLanguage: 'en'
    }
  }
];

// Demo case scenarios
const demoCaseScenarios = [
  {
    title: 'Rape Case - Immediate Action Required',
    content: `FIRST INFORMATION REPORT
Police Station: Connaught Place, New Delhi
Date: ${new Date().toDateString()}

Complainant: Ms. Victim Name (Identity Protected)
Accused: Mr. Accused Name

Details: The complainant has filed a case under IPC Section 376 (Rape). The incident occurred on ${new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toDateString()}. Medical examination has been conducted. Evidence has been collected. Accused is currently absconding.

This case requires immediate attention due to the serious nature of the crime and potential flight risk of the accused.`,
    expectedUrgency: 'URGENT',
    expectedAreas: ['criminal'],
    clientEmail: 'ramesh.client@gmail.com'
  },
  {
    title: 'Property Dispute - Possession Issue',
    content: `CIVIL SUIT FOR POSSESSION AND DAMAGES
Court: District Court, Mumbai
Date: ${new Date().toDateString()}

Plaintiff: Priya Sharma
Defendant: Builder XYZ Ltd.

The plaintiff purchased a flat in ABC Towers, Mumbai for Rs. 1.2 Crores in 2020. Despite full payment, possession has not been given. The builder is now claiming additional charges and delaying possession.

Seeking: 1) Possession of the flat 2) Compensation for rental expenses 3) Interest on delayed possession

Property Details: 2BHK, Flat No. 504, ABC Towers, Andheri West, Mumbai
Registration No: MH/2020/12345`,
    expectedUrgency: 'MODERATE',
    expectedAreas: ['civil'],
    clientEmail: 'priya.client@gmail.com'
  },
  {
    title: 'Cyber Crime - Data Breach',
    content: `COMPLAINT UNDER IT ACT 2000
Cyber Crime Cell: Bangalore
Date: ${new Date().toDateString()}

Complainant: TechCorp Solutions Pvt. Ltd.
Nature: Data Breach and Cyber Attack

Our company's database was hacked on ${new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toDateString()}. Personal data of 50,000+ customers including names, phone numbers, email addresses, and encrypted payment information was compromised.

The attack appears to be sophisticated, possibly by organized cyber criminals. We have preserved all digital evidence and server logs. Immediate action is required to prevent further damage and to comply with data protection regulations.

Sections applicable: IT Act 2000 Section 66, 66C, 66D, 43A
Estimated Loss: Rs. 2 Crores (direct + indirect)`,
    expectedUrgency: 'URGENT',
    expectedAreas: ['cyber'],
    clientEmail: 'tech.startup@company.com'
  }
];

async function seedDatabase() {
  try {
    // Connect to MongoDB
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/panchtatva-justice');
    
    console.log('Connected to MongoDB');
    
    // Clear existing data (be careful in production!)
    if (process.env.NODE_ENV !== 'production') {
      await User.deleteMany({});
      await Case.deleteMany({});
      console.log('Cleared existing data');
    }
    
    // Create demo users
    console.log('Creating demo users...');
    const createdUsers = await User.insertMany(demoUsers);
    console.log(`Created ${createdUsers.length} demo users`);
    
    // Log user credentials for testing
    console.log('\n=== DEMO USER CREDENTIALS ===');
    createdUsers.forEach(user => {
      console.log(`${user.role.toUpperCase()}: ${user.email}`);
    });
    console.log('Note: Use OTP authentication to login');
    console.log('================================\n');
    
    // Create demo cases (optional - these would normally be created via file upload)
    console.log('Demo cases can be created by uploading PDFs through the web interface');
    
    console.log('Database seeding completed successfully!');
    
    // Display system information
    console.log('\n=== SYSTEM INFORMATION ===');
    console.log('Judges:', createdUsers.filter(u => u.role === 'judge').length);
    console.log('Lawyers:', createdUsers.filter(u => u.role === 'lawyer').length);
    console.log('Clients:', createdUsers.filter(u => u.role === 'client').length);
    console.log('Admins:', createdUsers.filter(u => u.role === 'admin').length);
    console.log('==========================');
    
  } catch (error) {
    console.error('Seeding failed:', error);
  } finally {
    await mongoose.disconnect();
    console.log('Disconnected from MongoDB');
  }
}

// Run seeding if called directly
if (require.main === module) {
  seedDatabase();
}

module.exports = { seedDatabase, demoUsers, demoCaseScenarios };
