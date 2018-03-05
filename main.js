const Apify = require('apify');
const typeCheck = require('type-check').typeCheck;
const puppeteer = require('puppeteer');
const cheerio = require('cheerio');

// Definition of the input
const INPUT_TYPE = `{
    source: String,
    query: String,
    dictionary: Maybe String,
}`;

Apify.main(async () => {
    // Fetch the input and check it has a valid format
    // You don't need to check the input, but it's a good practice.
    const input = await Apify.getValue('INPUT');
    if (!typeCheck(INPUT_TYPE, input)) {
        console.log('Expected input:');
        console.log(INPUT_TYPE);
        console.log('Received input:');
        console.dir(input);
        throw new Error('Received invalid input');
    }

    // Environment variables
    const launchPuppeteer = process.env.NODE_ENV === 'development' ? puppeteer.launch : Apify.launchPuppeteer;
    const browser = await launchPuppeteer();

    // Navigate to Reverso Conjugation
    const uri = `http://conjugator.reverso.net/conjugation-${input.source}-verb-${input.query}.html`
    const page = await browser.newPage();
    await page.goto(uri);
    let html = await page.content();
    let $ = cheerio.load(html);

    let results = [
        {
            form: 'infinitif',
            tense: 'présent',
            pronoun: '',
            conjugation: input.query
        }, {
            form: 'participe présent',
            tense: 'présent',
            pronoun: '',
            conjugation: $('.verb-forms-wrap a').eq(1).text().trim()
        }, {
            form: 'participe passé',
            tense: 'passé',
            pronoun: '',
            conjugation: $('.verb-forms-wrap a').eq(2).text().trim()
        }
    ];

    // Navigate to Word Reference Conjugation
    const uri2 = `https://www.wordreference.com/conj/FrVerbs.aspx?v=${input.query}`
    const page2 = await browser.newPage();
    await page2.goto(uri2);
    html = await page2.content();
    $ = cheerio.load(html);

    // Get verb conjugation list
    const getConjugation = (e) => {
        const conj = $(e).find('td').text().trim();
        const regex = new RegExp(/(.*?)\(.*/);
        const extracted = regex.exec(conj);
        return extracted === null ? conj : extracted[1];
    }

    const pronoun = {
        1: '1s',
        2: '2s',
        3: '3s',
        4: '1p',
        5: '2p',
        6: '3p',
    }

    // extracting from table
    $('.aa').each((i, elem) => {
        const form = $(elem).find('h4').text().trim()
        $(elem).find('tbody').each((j, elem2) => {
            const tense = $(elem2).find('tr').eq(0).text().trim();
            $(elem2).find('tr').each((k, elem3) => {
                // Do not add first <tr> tag, that indicates the tense
                const conjugation = getConjugation(elem3);
                k === 0 || conjugation === '–' ?
                    null :
                    results.push({
                        form,
                        tense,
                        pronoun: pronoun[k],
                        conjugation,
                    })
            })
        })
    });

    // Here's the place for your magic...
    console.log(`Input query: ${input.query}`);
    // console.log('Results: ', results)

    // Store the output
    const output = {
        name: 'apify/igsys/conjugation-wr',
        crawledAt: new Date(),
        input,
        uri,
        results,
    };
    await Apify.setValue('OUTPUT', output)
});
