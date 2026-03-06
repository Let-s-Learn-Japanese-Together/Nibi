export default async function fetchGoogleSheet(id: string) {
    // first, lets fetch the google sheet
    const link = `https://docs.google.com/spreadsheets/d/${id}/gviz/tq?tqx=out:csv`;
    const request = await fetch(link);
    if (!request.ok) {
        throw new Error(`Error fetching Google Sheet: ${request.statusText}`);
    }
    const data = await request.text();
    const rows = data.trim().split('\n').map(row => row.split(',').map(cell => cell.trim()));
    const [header, ...body] = rows;
    const json = body.map(row => {
        const obj: Record<string, string> = {};
        if (header) {
            header.forEach((key, i) => {
                obj[key] = row[i] ?? '';
            });
        }
        return obj;
    });

    return json.map(row => {
        /** 
         * Row exemple :
         *   {
         *      '"Horodateur"': '"dd/mm/aaa hh:mm:ss"',
         *      '"Score"': '"x / y"',
         *      '"Adresse e-mail"': '"address@email.com"',
         *      ...
         *  }
         * to
         * {
         *      "email": "address@email.com"
         *      "totalPoints": "y"
         *      "score": "x"
         *      "timestamp": "dd/mm/aaa hh:mm:ss"
         *      "ratio": "x/y"
         * }
        */
        const cleanedRow: Record<string, string | number> = {}
        for (const key in row) {
            const cleanedKey = key.replace(/"/g, '').toLowerCase();
            let cleanedValue = row[key] ? row[key].replace(/"/g, '') : '';
            if (cleanedKey.indexOf('mail') !== -1) {
                cleanedRow['email'] = cleanedValue;
            }
            else if (cleanedKey === 'score') {
                const [score, totalPoints]: number[] = cleanedValue.split('/').map(s => parseInt(s.trim())) as number[];
                if(!score || !totalPoints) {
                    continue;
                }
                cleanedRow['score'] = score ?? '';
                cleanedRow['totalPoints'] = totalPoints ?? '';
                cleanedRow['ratio'] = score / totalPoints;
                cleanedRow['lessonId'] = id;
            }
        }
        return cleanedRow;
    });
}