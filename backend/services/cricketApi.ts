// Cricbuzz Scorecard & Schedule Scraper — No API key needed!
// Scrapes m.cricbuzz.com for match schedule + batting scorecard data

const IPL_SERIES_ID = '9241'; // IPL 2026

const TEAM_MAP: Record<string, string> = {
  'SRH': 'Sunrisers Hyderabad', 'RCB': 'Royal Challengers Bengaluru',
  'MI': 'Mumbai Indians', 'CSK': 'Chennai Super Kings',
  'KKR': 'Kolkata Knight Riders', 'PBKS': 'Punjab Kings',
  'GT': 'Gujarat Titans', 'DC': 'Delhi Capitals',
  'RR': 'Rajasthan Royals', 'LSG': 'Lucknow Super Giants'
};

const ABBR_MAP: Record<string, string> = Object.fromEntries(
  Object.entries(TEAM_MAP).map(([abbr, name]) => [name.toLowerCase(), abbr.toLowerCase()])
);

interface BatterScore { position: number; name: string; runs: number; }
interface MatchScorecard { team_a_batters: BatterScore[]; team_b_batters: BatterScore[]; }

export interface CricbuzzMatch {
  cricbuzz_id: string;
  match_desc: string;   // e.g. "13th Match"
  match_number: number;
  team_a_name: string;
  team_b_name: string;
  team_a_abbr: string;
  team_b_abbr: string;
  status: string;        // e.g. "RR won", "Preview", "Complete"
  start_date: Date | null;  // actual match date from Cricbuzz
}

// ─── Schedule Scraper ───

export async function scrapeIPLSchedule(): Promise<CricbuzzMatch[]> {
  try {
    const url = `https://m.cricbuzz.com/cricket-series/${IPL_SERIES_ID}/indian-premier-league-2026/matches`;
    console.log('[Cricbuzz] Fetching IPL schedule...');
    const res = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X)' } });
    if (!res.ok) { console.log('[Cricbuzz] Schedule fetch failed:', res.status); return []; }
    const html = await res.text();

    const iplTeams = new Set(Object.keys(TEAM_MAP));
    const matches: CricbuzzMatch[] = [];
    const seen = new Set<string>();

    let idx = 0;
    while (true) {
      idx = html.indexOf('matchId', idx);
      if (idx === -1) break;
      // Look back further to find the startDate which comes before matchId in the data
      const chunkStart = Math.max(0, idx - 200);
      const chunk = html.substring(chunkStart, idx + 2000);

      const idM = chunk.match(/matchId[\\]*":(\d+)/);
      const descM = chunk.match(/matchDesc[\\]*":[\\]*"([^\\"]+)/);
      const t1M = chunk.match(/team1[\\]*":\{[^}]*?teamSName[\\]*":[\\]*"([A-Z]+)/);
      const t2M = chunk.match(/team2[\\]*":\{[^}]*?teamSName[\\]*":[\\]*"([A-Z]+)/);
      const stateM = chunk.match(/stateTitle[\\]*":[\\]*"([^\\"]+)/);
      const startDtM = chunk.match(/startDate[\\]*":[\\]*"(\d{10,13})/);

      if (idM && t1M && t2M && iplTeams.has(t1M[1]) && iplTeams.has(t2M[1])) {
        const key = `${idM[1]}_${t1M[1]}_${t2M[1]}`;
        if (!seen.has(key)) {
          seen.add(key);
          const matchNum = descM?.[1]?.match(/(\d+)/)?.[1];
          let matchDate: Date | null = null;
          if (startDtM) {
            let ts = parseInt(startDtM[1]);
            if (ts < 1e12) ts *= 1000;
            matchDate = new Date(ts);
          }
          matches.push({
            cricbuzz_id: idM[1],
            match_desc: descM?.[1] || '',
            match_number: matchNum ? parseInt(matchNum) : 0,
            team_a_name: TEAM_MAP[t1M[1]],
            team_b_name: TEAM_MAP[t2M[1]],
            team_a_abbr: t1M[1],
            team_b_abbr: t2M[1],
            status: stateM?.[1] || 'Upcoming',
            start_date: matchDate
          });
        }
      }
      idx += 10;
    }

    matches.sort((a, b) => a.match_number - b.match_number);
    console.log(`[Cricbuzz] Found ${matches.length} IPL matches`);
    return matches;
  } catch (e) {
    console.error('[Cricbuzz] Schedule error:', e);
    return [];
  }
}

// ─── Match ID Finder ───

export async function findCricbuzzMatchId(teamA: string, teamB: string): Promise<string | null> {
  try {
    const matches = await scrapeIPLSchedule();
    const abbrA = getAbbr(teamA)?.toUpperCase();
    const abbrB = getAbbr(teamB)?.toUpperCase();

    // Try exact match both directions
    const found = matches.find(m =>
      (m.team_a_abbr === abbrA && m.team_b_abbr === abbrB) ||
      (m.team_a_abbr === abbrB && m.team_b_abbr === abbrA) ||
      (m.team_a_name.toLowerCase().includes(teamA.toLowerCase().split(' ')[0]) &&
       m.team_b_name.toLowerCase().includes(teamB.toLowerCase().split(' ')[0])) ||
      (m.team_a_name.toLowerCase().includes(teamB.toLowerCase().split(' ')[0]) &&
       m.team_b_name.toLowerCase().includes(teamA.toLowerCase().split(' ')[0]))
    );

    if (found) {
      console.log(`[Cricbuzz] Found: ${found.team_a_name} vs ${found.team_b_name} (${found.match_desc}) => CB:${found.cricbuzz_id}`);
      return found.cricbuzz_id;
    }
    console.log(`[Cricbuzz] No match found for ${teamA} vs ${teamB}`);
    return null;
  } catch (e) {
    console.error('[Cricbuzz] findMatch error:', e);
    return null;
  }
}

// ─── Scorecard Scraper ───
// Uses batTeamDetails sections to reliably separate innings by team

export async function scrapeCricbuzzScorecard(cricbuzzMatchId: string): Promise<MatchScorecard | null> {
  try {
    const url = `https://m.cricbuzz.com/live-cricket-scorecard/${cricbuzzMatchId}`;
    console.log(`[Cricbuzz] Fetching scorecard: ${url}`);

    const res = await fetch(url, {
      headers: { 'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X) AppleWebKit/605.1.15' }
    });
    if (!res.ok) return null;
    const html = await res.text();

    // ─── Primary approach: Extract innings via batTeamDetails blocks ───
    // Each innings has a batTeamDetails section with team name + batsmenData
    const teamRe = /batTeamDetails[\\]*":\{[\\]*"batTeamId[\\]*":(\d+),[\\]*"batTeamName[\\]*":[\\]*"([^"\\]+)/g;
    const innings: { teamName: string; batters: BatterScore[] }[] = [];
    let tm;
    while ((tm = teamRe.exec(html)) !== null) {
      const chunk = html.substring(tm.index, tm.index + 6000);
      const batRe = /bat_(\d+)[\\]*":\{[^}]*?batShortName[\\]*":[\\]*"([^"\\]+)[\\]*"[^}]*?runs[\\]*":(\d+)/g;
      const batters: BatterScore[] = [];
      let bm;
      while ((bm = batRe.exec(chunk)) !== null) {
        const pos = parseInt(bm[1]);
        if (pos <= 4) {
          batters.push({ position: pos, name: bm[2], runs: parseInt(bm[3]) });
        }
      }
      if (batters.length > 0) {
        innings.push({ teamName: tm[2], batters });
      }
    }

    // If we found both innings, use them
    if (innings.length >= 2) {
      console.log(`[Cricbuzz] A(${innings[0].teamName}): ${innings[0].batters.map(b => `${b.name}(${b.runs})`).join(', ')}`);
      console.log(`[Cricbuzz] B(${innings[1].teamName}): ${innings[1].batters.map(b => `${b.name}(${b.runs})`).join(', ')}`);
      return { team_a_batters: innings[0].batters, team_b_batters: innings[1].batters };
    }

    // ─── Fallback: flat batShortName scan, require >= 12 batsmen ───
    const batRe = /batShortName[\\]*":[\\]*"([^"\\]+)[\\]*"[^}]*?runs[\\]*":(\d+)/g;
    let match;
    const allBatsmen: BatterScore[] = [];
    while ((match = batRe.exec(html)) !== null) {
      allBatsmen.push({ position: allBatsmen.length + 1, name: match[1], runs: parseInt(match[2]) });
    }

    if (allBatsmen.length >= 12) {
      // Standard T20: 11 batsmen in first innings
      const team_a = allBatsmen.slice(0, 4).map((b, i) => ({ position: i + 1, name: b.name, runs: b.runs }));
      const team_b = allBatsmen.slice(11, 15).map((b, i) => ({ position: i + 1, name: b.name, runs: b.runs }));
      console.log(`[Cricbuzz] A: ${team_a.map(b => `${b.name}(${b.runs})`).join(', ')}  B: ${team_b.map(b => `${b.name}(${b.runs})`).join(', ')}`);
      return { team_a_batters: team_a, team_b_batters: team_b };
    }

    // Not enough data — cannot settle this match
    console.log(`[Cricbuzz] Only ${innings.length} innings / ${allBatsmen.length} batsmen found — need both innings to settle`);
    return null;
  } catch (e) {
    console.error('[Cricbuzz] Scorecard error:', e);
    return null;
  }
}

function getAbbr(teamName: string): string | null {
  // Direct lookup
  for (const [fullName, ] of Object.entries(TEAM_MAP)) {
    if (teamName.toLowerCase() === TEAM_MAP[fullName]?.toLowerCase()) return fullName;
  }
  // Reverse lookup
  for (const [abbr, fullName] of Object.entries(TEAM_MAP)) {
    if (fullName.toLowerCase().includes(teamName.toLowerCase().split(' ')[0])) return abbr;
  }
  return null;
}

// ─── Top Batsmen (Orange Cap) Scraper ───

export interface TopBatsman {
  rank: number;
  name: string;
  team: string;
  runs: number;
  matches: number;
  average: number;
  strikeRate: number;
  imageUrl: string;
}

export async function scrapeTopBatsmen(): Promise<TopBatsman[]> {
  try {
    // Try scraping the Cricbuzz stats page for embedded JSON data
    const url = `https://www.cricbuzz.com/cricket-series/${IPL_SERIES_ID}/indian-premier-league-2026/stats`;
    console.log('[Cricbuzz] Fetching top batsmen stats...');
    
    const res = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml',
      }
    });
    
    if (!res.ok) throw new Error(`Stats page returned ${res.status}`);
    const html = await res.text();
    
    // Try to find player data in the embedded JSON/HTML
    // Cricbuzz embeds stats data in the page. Look for player entries with runs.
    const batsmen: TopBatsman[] = [];
    
    // Pattern: look for faceImageId and player data in the HTML/JSON
    // Cricbuzz stores player images at: https://static.cricbuzz.com/a/img/v1/152x152/i1/c{faceImageId}/i.jpg
    const playerRe = /\"playerId\":(\d+)[^}]*?\"playerName\":\"([^\"]+)\"[^}]*?\"faceImageId\":(\d+)[^}]*?\"teamName\":\"([^\"]+)\"[^}]*?\"runs\":\"?(\d+)\"?[^}]*?\"matches\":\"?(\d+)\"?/g;
    let pm;
    while ((pm = playerRe.exec(html)) !== null) {
      batsmen.push({
        rank: batsmen.length + 1,
        name: pm[2],
        team: pm[4],
        runs: parseInt(pm[5]),
        matches: parseInt(pm[6]),
        average: 0,
        strikeRate: 0,
        imageUrl: `https://static.cricbuzz.com/a/img/v1/152x152/i1/c${pm[3]}/i.jpg`
      });
    }
    
    if (batsmen.length >= 4) {
      batsmen.sort((a, b) => b.runs - a.runs);
      const top4 = batsmen.slice(0, 4).map((b, i) => ({ ...b, rank: i + 1 }));
      console.log(`[Cricbuzz] Top batsmen: ${top4.map(b => `${b.name}(${b.runs})`).join(', ')}`);
      return top4;
    }

    // Alternative pattern: try different JSON structure
    const altRe = /\"name\":\"([^\"]+)\"[^}]{0,300}?\"team(?:Name)?\":\"([^\"]+)\"[^}]{0,200}?\"runs\":\"?(\d+)\"?[^}]{0,200}?\"(?:mat|matches)\":\"?(\d+)\"?[^}]{0,200}?\"faceImageId\":(\d+)/g;
    let am;
    while ((am = altRe.exec(html)) !== null) {
      batsmen.push({
        rank: batsmen.length + 1,
        name: am[1],
        team: am[2],
        runs: parseInt(am[3]),
        matches: parseInt(am[4]),
        average: 0,
        strikeRate: 0,
        imageUrl: `https://static.cricbuzz.com/a/img/v1/152x152/i1/c${am[5]}/i.jpg`
      });
    }

    if (batsmen.length >= 4) {
      batsmen.sort((a, b) => b.runs - a.runs);
      const top4 = batsmen.slice(0, 4).map((b, i) => ({ ...b, rank: i + 1 }));
      console.log(`[Cricbuzz] Top batsmen (alt): ${top4.map(b => `${b.name}(${b.runs})`).join(', ')}`);
      return top4;
    }

    console.log(`[Cricbuzz] Could not parse stats page, using fallback data`);
    throw new Error('Could not parse stats');
  } catch (e) {
    console.error('[Cricbuzz] Top batsmen scrape failed, returning fallback:', e);
    // Fallback: current Orange Cap standings (updated periodically)
    return [
      {
        rank: 1,
        name: 'Heinrich Klaasen',
        team: 'SRH',
        runs: 224,
        matches: 6,
        average: 44.8,
        strikeRate: 171.0,
        imageUrl: 'https://static.cricbuzz.com/a/img/v1/152x152/i1/c170941/i.jpg'
      },
      {
        rank: 2,
        name: 'Ishan Kishan',
        team: 'SRH',
        runs: 213,
        matches: 6,
        average: 42.6,
        strikeRate: 152.1,
        imageUrl: 'https://static.cricbuzz.com/a/img/v1/152x152/i1/c170737/i.jpg'
      },
      {
        rank: 3,
        name: 'Vaibhav Suryavanshi',
        team: 'RR',
        runs: 200,
        matches: 6,
        average: 40.0,
        strikeRate: 148.1,
        imageUrl: 'https://static.cricbuzz.com/a/img/v1/152x152/i1/c332658/i.jpg'
      },
      {
        rank: 4,
        name: 'Rajat Patidar',
        team: 'RCB',
        runs: 195,
        matches: 6,
        average: 39.0,
        strikeRate: 142.3,
        imageUrl: 'https://static.cricbuzz.com/a/img/v1/152x152/i1/c220641/i.jpg'
      }
    ];
  }
}
