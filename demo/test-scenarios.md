# Panchtatva Justice Automation - Test Scenarios

## Demo Script for System Demonstration

### Prerequisites
1. System deployed and running
2. Demo data seeded (run `node demo/seed-data.js`)
3. API keys configured (OpenAI, News API, Email)

### Demo User Accounts

#### Admin Account
- **Email**: admin@panchtatva.in
- **Role**: System Administrator
- **Capabilities**: Full system access, user management, metrics

#### Judge Accounts
1. **Chief Justice Rajesh Sharma**
   - Email: judge.sharma@court.gov.in
   - Specialization: Criminal, Constitutional
   - Seniority: Chief
   - Court: Delhi High Court

2. **Justice Priya Patel**
   - Email: judge.patel@court.gov.in
   - Specialization: Civil, Family
   - Seniority: Senior
   - Court: Mumbai High Court

3. **Justice Anand Kumar**
   - Email: judge.kumar@court.gov.in
   - Specialization: Cyber, Corporate
   - Seniority: Junior
   - Court: Bangalore High Court

#### Lawyer Accounts
1. **Adv. Vikram Singh** (Criminal Law Expert)
   - Email: advocate.singh@lawfirm.com
   - Experience: 15 years
   - Specialization: IPC, CrPC, POCSO

2. **Adv. Lakshmi Reddy** (Civil Law Expert)
   - Email: advocate.reddy@lawfirm.com
   - Experience: 12 years
   - Specialization: Property, Matrimonial

3. **Adv. Rohit Gupta** (Cyber Law Expert)
   - Email: advocate.gupta@techlaw.in
   - Experience: 8 years
   - Specialization: IT Act, Data Protection

#### Client Accounts
1. **Ramesh Kumar**
   - Email: ramesh.client@gmail.com
   - Region: Delhi

2. **Priya Sharma**
   - Email: priya.client@gmail.com
   - Region: Mumbai

3. **TechCorp Solutions**
   - Email: tech.startup@company.com
   - Region: Bangalore

---

## Test Scenario 1: Urgent Criminal Case (Rape Case)

### Objective
Demonstrate urgent case classification, news escalation, and senior assignment.

### Steps

1. **Client Login & Case Upload**
   - Login as: ramesh.client@gmail.com
   - Upload PDF with rape case content (IPC 376)
   - Title: "Rape Case - Immediate Action Required"
   - Jurisdiction: "Delhi"

2. **System Processing (Automated)**
   - Text extraction from PDF
   - AI classification → Expected: URGENT
   - News sensitivity check → May escalate urgency
   - Auto-assignment to senior judge and experienced criminal lawyer

3. **Expected Assignment**
   - Judge: Justice Rajesh Sharma (Chief, Criminal expertise)
   - Lawyer: Adv. Vikram Singh (Criminal law expert)
   - Processing time: < 60 seconds

4. **Judge Dashboard Verification**
   - Login as: judge.sharma@court.gov.in
   - Verify case appears in priority queue (URGENT badge)
   - Check case details and AI classification
   - Accept assignment

5. **Lawyer Dashboard Verification**
   - Login as: advocate.singh@lawfirm.com
   - Verify case assignment notification
   - Review case details and extracted facts
   - Check urgency indicators

6. **Admin Monitoring**
   - Login as: admin@panchtatva.in
   - Check system metrics
   - Review assignment decision breakdown
   - Verify audit logs

### Expected Results
- ✅ Case classified as URGENT
- ✅ Assigned within 60 seconds
- ✅ Senior judge with criminal expertise assigned
- ✅ Experienced criminal lawyer assigned
- ✅ All stakeholders notified via email
- ✅ Audit trail created

---

## Test Scenario 2: Moderate Civil Case (Property Dispute)

### Objective
Demonstrate moderate urgency classification and appropriate assignment.

### Steps

1. **Client Case Upload**
   - Login as: priya.client@gmail.com
   - Upload property dispute PDF
   - Title: "Property Dispute - Possession Issue"
   - Jurisdiction: "Mumbai"

2. **System Processing**
   - AI classification → Expected: MODERATE
   - News check → Low sensitivity expected
   - Assignment to civil law specialists

3. **Expected Assignment**
   - Judge: Justice Priya Patel (Civil expertise, Mumbai court)
   - Lawyer: Adv. Lakshmi Reddy (Civil law, property specialist)

4. **Verification Steps**
   - Check judge dashboard for moderate priority case
   - Verify lawyer assignment and case details
   - Confirm geographic jurisdiction match (Mumbai)

### Expected Results
- ✅ Case classified as MODERATE
- ✅ Civil law specialists assigned
- ✅ Geographic jurisdiction matched
- ✅ Appropriate priority in queue

---

## Test Scenario 3: High-Tech Cyber Crime Case

### Objective
Demonstrate cyber crime classification, news sensitivity, and specialist assignment.

### Steps

1. **Corporate Client Upload**
   - Login as: tech.startup@company.com
   - Upload cyber crime case PDF (data breach)
   - Title: "Cyber Crime - Data Breach"
   - Jurisdiction: "Bangalore"

2. **System Processing**
   - AI classification → Expected: URGENT (data breach, large scale)
   - News sensitivity → May find relevant cyber crime news
   - Specialist assignment required

3. **Expected Assignment**
   - Judge: Justice Anand Kumar (Cyber expertise, Bangalore)
   - Lawyer: Adv. Rohit Gupta (Cyber law specialist)

4. **News Sensitivity Check**
   - System searches for related cyber crime news
   - Calculates sensitivity score
   - May escalate urgency based on news volume

### Expected Results
- ✅ Cyber crime expertise matched
- ✅ News sensitivity calculated
- ✅ Tech-savvy specialists assigned
- ✅ Bangalore jurisdiction matched

---

## Test Scenario 4: Conflict of Interest Handling

### Objective
Demonstrate conflict detection and alternative assignment.

### Steps

1. **Setup Conflict**
   - Login as: advocate.singh@lawfirm.com
   - Add conflict: ramesh.client@gmail.com
   - Reason: "Previous adverse representation"

2. **Upload Conflicted Case**
   - Login as: ramesh.client@gmail.com
   - Upload another case
   - System should detect conflict and assign alternative lawyer

3. **Verification**
   - Verify Adv. Singh is NOT assigned
   - Check alternative lawyer assignment
   - Confirm conflict logged in audit

### Expected Results
- ✅ Conflict detected automatically
- ✅ Alternative lawyer assigned
- ✅ Conflict reason logged
- ✅ No assignment to conflicted lawyer

---

## Test Scenario 5: System Overload Handling

### Objective
Demonstrate admin escalation when no suitable candidates available.

### Steps

1. **Simulate Overload**
   - Use admin panel to set all lawyers to max capacity
   - Upload new case
   - System should escalate to admin queue

2. **Admin Intervention**
   - Login as admin
   - Review escalated cases
   - Manually adjust capacity or reassign

3. **Verification**
   - Case status shows "error" or "pending"
   - Admin notification sent
   - Case appears in admin queue

### Expected Results
- ✅ Overload detected
- ✅ Admin escalation triggered
- ✅ Case queued for manual review
- ✅ System remains stable

---

## Test Scenario 6: News Sensitivity Escalation

### Objective
Demonstrate news-based urgency escalation.

### Steps

1. **Upload Politically Sensitive Case**
   - Create case with keywords likely to trigger news sensitivity
   - Examples: "communal violence", "political protest", "encounter"

2. **Monitor News Check**
   - System searches recent news for related keywords
   - Calculates sensitivity score
   - May escalate urgency from MODERATE to URGENT

3. **Verification**
   - Check news signals in case details
   - Verify urgency escalation if triggered
   - Confirm senior assignment if escalated

### Expected Results
- ✅ News sensitivity calculated
- ✅ Urgency escalated if high sensitivity
- ✅ Senior resources assigned for sensitive cases

---

## Performance Benchmarks

### Target Processing Times
- **Non-OCR PDF**: < 60 seconds (upload to assignment)
- **OCR Required**: < 180 seconds
- **AI Classification**: < 10 seconds
- **News Sensitivity**: < 20 seconds
- **Assignment Engine**: < 5 seconds

### Success Criteria
- **Assignment Success Rate**: > 95%
- **Urgency Classification Accuracy**: > 90%
- **News Sensitivity Relevance**: > 80%
- **Conflict Detection**: 100%
- **System Uptime**: > 99%

---

## Testing Checklist

### Functional Testing
- [ ] OTP authentication works
- [ ] PDF upload and processing
- [ ] Text extraction (regular and OCR)
- [ ] AI classification accuracy
- [ ] News sensitivity checking
- [ ] Assignment engine logic
- [ ] Conflict detection
- [ ] Email notifications
- [ ] Role-based access control
- [ ] Admin functions

### Security Testing
- [ ] Authentication bypass attempts
- [ ] Authorization checks
- [ ] Input validation
- [ ] File upload restrictions
- [ ] Rate limiting
- [ ] Audit logging
- [ ] Data encryption
- [ ] Session management

### Performance Testing
- [ ] Concurrent user handling
- [ ] Large file processing
- [ ] Database performance
- [ ] API response times
- [ ] Memory usage
- [ ] CPU utilization
- [ ] Network bandwidth

### Integration Testing
- [ ] OpenAI API integration
- [ ] News API integration
- [ ] Email service integration
- [ ] Database operations
- [ ] File storage (GridFS)
- [ ] Frontend-backend communication

---

## Troubleshooting Common Issues

### 1. OTP Not Received
- Check email spam folder
- Verify EMAIL_HOST_PASSWORD is app password
- Check Gmail 2FA settings
- Review email service logs

### 2. AI Classification Fails
- Verify OPENAI_API_KEY
- Check API quota and billing
- Monitor rate limits
- Review extracted text quality

### 3. News API Issues
- Verify API key validity
- Check quota limits
- Test with alternative provider
- Review network connectivity

### 4. Assignment Failures
- Check user availability settings
- Verify expertise mappings
- Review conflict configurations
- Monitor system capacity

### 5. File Upload Problems
- Check file size limits
- Verify PDF format
- Test with different browsers
- Review GridFS configuration

---

## Demo Presentation Flow

### Introduction (5 minutes)
- System overview and objectives
- Key features and benefits
- Architecture highlights

### Live Demo (20 minutes)
1. **Client Experience** (5 min)
   - Login process
   - Case upload
   - Status tracking

2. **System Processing** (5 min)
   - Real-time processing stages
   - AI classification results
   - News sensitivity scoring

3. **Professional Dashboards** (10 min)
   - Judge priority queue
   - Lawyer case management
   - Admin system overview

### Technical Deep Dive (10 minutes)
- Assignment algorithm explanation
- Security features
- Audit and compliance
- Performance metrics

### Q&A and Discussion (10 minutes)
- Address technical questions
- Discuss customization options
- Future enhancements
- Implementation timeline

---

## Success Metrics

### Operational Efficiency
- **Case Processing Time**: Reduced from hours to minutes
- **Assignment Accuracy**: 95%+ appropriate matches
- **Manual Intervention**: < 5% of cases
- **User Satisfaction**: > 90% positive feedback

### System Performance
- **Uptime**: 99.9%
- **Response Time**: < 2 seconds average
- **Concurrent Users**: 100+ supported
- **Data Integrity**: 100% maintained

### Compliance and Security
- **Audit Coverage**: 100% of actions logged
- **Data Encryption**: All sensitive data encrypted
- **Access Control**: Role-based permissions enforced
- **Privacy Protection**: PII handling compliant

This comprehensive test suite ensures the Panchtatva Justice Automation system meets all requirements and performs reliably in production environments.
