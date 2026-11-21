require('dotenv').config();
const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

const H = 3600 * 1000;
const MSG = {
  en: 'Your complaint has been recorded and sent to the concerned department.',
  ta: 'உங்கள் புகார் பதிவு செய்யப்பட்டு சம்பந்தப்பட்ட துறைக்கு அனுப்பப்பட்டது.',
  hi: 'आपकी शिकायत दर्ज हो गई है और संबंधित विभाग को भेज दी गई है।',
  te: 'మీ ఫిర్యాదు నమోదు చేయబడింది మరియు సంబంధిత శాఖకు పంపబడింది.',
  bn: 'আপনার অভিযোগ নথিভুক্ত হয়েছে এবং সংশ্লিষ্ট বিভাগে পাঠানো হয়েছে।',
  mr: 'तुमची तक्रार नोंदवली गेली आहे आणि संबंधित विभागाकडे पाठवली आहे.',
  ur: 'آپ کی شکایت درج کر لی گئی ہے اور متعلقہ محکمے کو بھیج دی گئی ہے۔'
};

// ago = hours since submitted; resolveAfter = hours until fixed (Resolved only)
const ROWS = [
  { id: 'CR-DEMO01', lang: 'ta', langName: 'Tamil', status: 'In Progress', ago: 50,
    title: 'சாலையில் பெரிய பள்ளம்', desc: 'பேருந்து நிறுத்தம் அருகே பெரிய பள்ளம் உள்ளது. நேற்று இரண்டு பைக்குகள் விழுந்தன.',
    enTitle: 'Large pothole on the road', enDesc: 'There is a big pothole near the bus stop. Two bikes fell in it yesterday.',
    cat: 'pothole', pri: 'High', dept: 'Roads',
    reason: 'Bikes have already fallen near a bus stop, so there is a clear accident risk.',
    summary: 'Large pothole near bus stop causing two-wheeler falls.',
    area: 'Gandhipuram, Coimbatore', lat: 11.0183, lng: 76.9725 },
  { id: 'CR-DEMO02', lang: 'hi', langName: 'Hindi', status: 'Reported', ago: 20,
    title: 'कचरे का ढेर', desc: 'गली के कोने पर तीन दिन से कचरा उठाया नहीं गया है, बदबू आ रही है।',
    enTitle: 'Pile of garbage', enDesc: 'Garbage at the street corner has not been collected for three days and it smells.',
    cat: 'garbage', pri: 'Medium', dept: 'Sanitation',
    reason: 'Uncollected garbage is causing a bad smell and a mild health nuisance for residents.',
    summary: 'Garbage uncollected for three days at a street corner.',
    area: 'Peelamedu, Coimbatore', lat: 11.0296, lng: 77.0248 },
  { id: 'CR-DEMO03', lang: 'en', langName: 'English', status: 'Reported', ago: 3,
    title: 'Exposed electric wire near school', desc: 'A streetlight pole near the school gate has exposed live wires. Children pass here every morning.',
    enTitle: 'Exposed electric wire near school', enDesc: 'A streetlight pole near the school gate has exposed live wires. Children pass here every morning.',
    cat: 'streetlight', pri: 'Critical', dept: 'Electricity',
    reason: 'Live exposed wires next to a school gate pose an immediate danger of electrocution to children.',
    summary: 'Exposed live wires on a streetlight pole at a school gate.',
    area: 'RS Puram, Coimbatore', lat: 11.0098, lng: 76.9507 },
  { id: 'CR-DEMO04', lang: 'te', langName: 'Telugu', status: 'In Progress', ago: 70,
    title: 'మురుగు కాలువ పొంగుతోంది', desc: 'మా వీధిలో డ్రైనేజీ పొంగి రోడ్డుపై నీరు నిలిచిపోయింది.',
    enTitle: 'Drain is overflowing', enDesc: 'The drain in our street is overflowing and water is standing on the road.',
    cat: 'drainage', pri: 'High', dept: 'Drainage',
    reason: 'Overflowing sewage water on the road is a health hazard and blocks pedestrians.',
    summary: 'Overflowing drain flooding a residential street.',
    area: 'Singanallur, Coimbatore', lat: 10.9988, lng: 77.0270 },
  { id: 'CR-DEMO05', lang: 'bn', langName: 'Bengali', status: 'Resolved', ago: 120, resolveAfter: 30,
    title: 'জলের পাইপ ফেটে গেছে', desc: 'রাস্তার পাশে জলের মূল পাইপ ফেটে গিয়ে সারাদিন জল নষ্ট হচ্ছে।',
    enTitle: 'Water pipe has burst', enDesc: 'The main water pipe beside the road has burst and water is being wasted all day.',
    cat: 'water_leakage', pri: 'High', dept: 'Water Supply',
    reason: 'A burst main wastes a large amount of drinking water and can damage the road.',
    summary: 'Burst main water pipe leaking continuously.',
    area: 'Saibaba Colony, Coimbatore', lat: 11.0273, lng: 76.9442 },
  { id: 'CR-DEMO06', lang: 'mr', langName: 'Marathi', status: 'Resolved', ago: 96, resolveAfter: 40,
    title: 'रस्त्यावरील पथदिवा बंद', desc: 'आमच्या गल्लीतील पथदिवा आठवडाभर बंद आहे, रात्री अंधार असतो.',
    enTitle: 'Streetlight not working', enDesc: 'The streetlight in our lane has been off for a week and it is dark at night.',
    cat: 'streetlight', pri: 'Medium', dept: 'Electricity',
    reason: 'A dark lane at night reduces safety for pedestrians, but there is no immediate hazard.',
    summary: 'Streetlight in a residential lane off for a week.',
    area: 'Race Course, Coimbatore', lat: 11.0049, lng: 76.9663 },
  { id: 'CR-DEMO07', lang: 'en', langName: 'English', status: 'Reported', ago: 8,
    title: 'Road edge caved in after rain', desc: 'Part of the road edge near the bridge has caved in and cars are swerving around it.',
    enTitle: 'Road edge caved in after rain', enDesc: 'Part of the road edge near the bridge has caved in and cars are swerving around it.',
    cat: 'road_damage', pri: 'High', dept: 'Roads',
    reason: 'A collapsed road edge near a bridge can cause vehicles to lose control.',
    summary: 'Road edge collapsed near a bridge after rain.',
    area: 'Ukkadam, Coimbatore', lat: 10.9886, lng: 76.9619 },
  { id: 'CR-DEMO08', lang: 'ur', langName: 'Urdu', status: 'Reported', ago: 28,
    title: 'نالی بند ہے', desc: 'ہماری گلی کی نالی بند ہے اور گندا پانی سڑک پر بہہ رہا ہے۔',
    enTitle: 'Drain is blocked', enDesc: 'The drain in our lane is blocked and dirty water is flowing onto the road.',
    cat: 'drainage', pri: 'Medium', dept: 'Drainage',
    reason: 'Blocked drain is spilling dirty water onto the road, causing a nuisance and some health risk.',
    summary: 'Blocked drain spilling dirty water onto the road.',
    area: 'Town Hall, Coimbatore', lat: 10.9930, lng: 76.9610 },
  { id: 'CR-DEMO09', lang: 'en', langName: 'English', status: 'In Progress', ago: 14,
    title: 'Open manhole cover on main road', desc: 'The manhole cover is missing on the busy main road and there is no barricade.',
    enTitle: 'Open manhole cover on main road', enDesc: 'The manhole cover is missing on the busy main road and there is no barricade.',
    cat: 'drainage', pri: 'Critical', dept: 'Drainage',
    reason: 'An open manhole on a busy road can cause severe accidents, especially at night.',
    summary: 'Missing manhole cover with no barricade on a main road.',
    area: 'Avinashi Road, Coimbatore', lat: 11.0235, lng: 77.0033 },
  { id: 'CR-DEMO10', lang: 'en', langName: 'English', status: 'Resolved', ago: 140, resolveAfter: 60,
    title: 'Faded zebra crossing near market', desc: 'The zebra crossing paint near the market has faded and is hard to see.',
    enTitle: 'Faded zebra crossing near market', enDesc: 'The zebra crossing paint near the market has faded and is hard to see.',
    cat: 'other', pri: 'Low', dept: 'Roads',
    reason: 'A faded crossing is a minor safety and cosmetic issue with no immediate danger.',
    summary: 'Zebra crossing markings faded near a market.',
    area: 'Gandhipuram, Coimbatore', lat: 11.0168, lng: 76.9558 }
];

async function main() {
  const client = await pool.connect();
  try {
    await client.query("DELETE FROM complaints WHERE tracking_id LIKE 'CR-DEMO%'");
    if (process.argv.includes('--clear')) {
      console.log('Demo complaints removed.');
      return;
    }
    await client.query('BEGIN');
    const now = Date.now();
    for (const r of ROWS) {
      const created = new Date(now - r.ago * H);
      const progressAt = new Date(created.getTime() + 4 * H);
      const resolvedAt = r.status === 'Resolved' ? new Date(created.getTime() + r.resolveAfter * H) : null;
      const updated = resolvedAt || (r.status === 'In Progress' ? progressAt : created);
      const note = r.status === 'Resolved' ? 'Issue fixed and verified by field staff.' : null;

      const ins = await client.query(
        `INSERT INTO complaints (
           tracking_id, title, description, english_title, english_description,
           language, detected_language, ai_category, category_mismatch, priority, priority_reason,
           department, english_summary, citizen_message, image_matches, needs_review,
           location_address, latitude, longitude, status, admin_notes, created_at, updated_at, resolved_at
         ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,false,$9,$10,$11,$12,$13,'no_image',false,$14,$15,$16,$17,$18,$19,$20,$21)
         RETURNING id`,
        [r.id, r.title, r.desc, r.enTitle, r.enDesc, r.lang, r.langName, r.cat, r.pri, r.reason,
         r.dept, r.summary, MSG[r.lang], r.area, r.lat, r.lng, r.status, note, created, updated, resolvedAt]
      );
      const cid = ins.rows[0].id;
      const log = (status, text, at) => client.query(
        'INSERT INTO complaint_logs (complaint_id, status, note, created_at) VALUES ($1,$2,$3,$4)',
        [cid, status, text, at]
      );
      await log('Reported', `Complaint submitted. AI Analysis: [${r.cat}] | Priority: [${r.pri}] | Department: [${r.dept}]`, created);
      if (r.status !== 'Reported') await log('In Progress', `Work order issued to the ${r.dept} department.`, progressAt);
      if (r.status === 'Resolved') await log('Resolved', note, resolvedAt);
    }
    await client.query('COMMIT');
    console.log(`Seeded ${ROWS.length} demo complaints (CR-DEMO01 to CR-DEMO10).`);
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    console.error('Seed failed:', err.message);
    process.exitCode = 1;
  } finally {
    client.release();
    await pool.end();
  }
}
main();
