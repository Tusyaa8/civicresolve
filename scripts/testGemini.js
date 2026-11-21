/**
 * Gemini AI Analysis Verification Script
 * Tests the analyzeComplaint function across 3 distinct Indian languages:
 * 1. English
 * 2. Hindi (हिन्दी)
 * 3. Tamil (தமிழ்)
 * Never logs API keys or secrets.
 */

const dns = require('dns');
dns.setDefaultResultOrder('ipv4first');

const { analyzeComplaint } = require('../src/services/gemini');

const SAMPLES = [
  {
    name: '1. English Complaint (Roads / Safety Hazard)',
    data: {
      title: 'Massive crater on 100ft road near Metro station',
      description: 'A very deep pothole has formed right in the middle of the bus lane. Two scooter riders fell yesterday. High traffic zone.',
      location: '100ft Ring Road, near Indiranagar Metro Station',
      category: null // Citizen let AI choose
    }
  },
  {
    name: '2. Hindi Complaint (Sanitation / Hospital Entrance)',
    data: {
      title: 'सरकारी अस्पताल के मुख्य द्वार पर कचरे का भारी ढेर',
      description: 'अस्पताल के गेट नंबर 2 के पास पिछले 5 दिनों से कचरा नहीं उठाया गया है। बहुत दुर्गंध है और मरीजों को सांस लेने में दिक्कत हो रही है। आवारा पशु घूम रहे हैं।',
      location: 'सिविल अस्पताल गेट नंबर 2, गांधी चौक',
      category: 'garbage' // Citizen specified category
    }
  },
  {
    name: '3. Tamil Complaint (Water Leakage / School Access)',
    data: {
      title: 'பள்ளி அருகில் உடைந்த குடிநீர் குழாய் மற்றும் நீர் தேக்கம்',
      description: 'அரசு தொடக்கப்பள்ளி வாசலில் முக்கிய குடிநீர் குழாய் உடைந்து சாலை முழுவதும் தண்ணீர் வீணாக ஓடுகிறது. குழந்தைகள் பள்ளிக்குள் செல்ல முடியவில்லை.',
      location: 'மெயின் ரோடு, அரசு பள்ளி அருகில், அண்ணா நகர்',
      category: 'water_leakage' // Citizen specified category
    }
  }
];

async function runGeminiTests() {
  console.log('================================================================');
  console.log('CivicResolve: Gemini AI Multi-Language Analysis Verification');
  console.log('================================================================\n');

  for (const sample of SAMPLES) {
    console.log(`>>> Testing Sample: ${sample.name}`);
    console.log(`Citizen Title: "${sample.data.title}"`);
    console.log(`Citizen Category Input: ${sample.data.category || '(Let AI decide)'}`);
    console.log('Calling Gemini AI triage engine...');

    const startTime = Date.now();
    const result = await analyzeComplaint(sample.data);
    const duration = ((Date.now() - startTime) / 1000).toFixed(2);

    console.log(`\nAnalysis Completed in ${duration}s:`);
    console.log('----------------------------------------------------------------');
    console.log(`- Detected Language : ${result.detected_language}`);
    console.log(`- English Title     : ${result.english_title}`);
    console.log(`- English Desc      : ${result.english_description}`);
    console.log(`- AI Category       : ${result.category}`);
    console.log(`- Priority          : ${result.priority}`);
    console.log(`- Priority Reason   : ${result.priority_reason}`);
    console.log(`- Department        : ${result.department}`);
    console.log(`- English Summary   : ${result.english_summary}`);
    console.log(`- Image Matches     : ${result.image_matches}`);
    console.log(`- Category Mismatch : ${result.category_mismatch}`);
    console.log(`- Needs Review Flag : ${result.needs_review}`);
    console.log(`- Citizen Message   : "${result.citizen_message}"`);
    console.log('----------------------------------------------------------------\n');
  }

  console.log('================================================================');
  console.log('All 3 multi-language Gemini test samples processed successfully.');
  console.log('================================================================');
}

runGeminiTests().catch((err) => {
  console.error('Test execution error:', err);
  process.exitCode = 1;
});
