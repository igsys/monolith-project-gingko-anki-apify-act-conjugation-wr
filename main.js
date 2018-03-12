const Apify = require('apify')
const typeCheck = require('type-check').typeCheck
const puppeteer = require('puppeteer')
const cheerio = require('cheerio')

// Definition of the input
const INPUT_TYPE = `{
    source: String,
    query: String,
    translation: Maybe String,
}`

Apify.main(async () => {
    // Fetch the input and check it has a valid format
    // You don't need to check the input, but it's a good practice.
    const input = await Apify.getValue('INPUT')
    if (!typeCheck(INPUT_TYPE, input)) {
        console.log('Expected input:')
        console.log(INPUT_TYPE)
        console.log('Received input:')
        console.dir(input)
        throw new Error('Received invalid input')
    }

    // Environment variables
    const launchPuppeteer = process.env.NODE_ENV === 'development' ? puppeteer.launch : Apify.launchPuppeteer
    const browser = await launchPuppeteer()

    // Navigate to Reverso Conjugation
    const uri = `http://conjugator.reverso.net/conjugation-${input.source}-verb-${input.query}.html`
    const page = await browser.newPage()
    await page.goto(uri, {
        timeout: 200000,
    })
    let html = await page.content()
    let $ = cheerio.load(html)

    let results = [
        {
            // form: 'infinitif',
            form: 'inf',
            tense: '',
            pronoun: '',
            gender: 'unknown',
            conjugation: input.query
        }, {
            // form: 'participe présent',
            form: 'par-pré',
            tense: '',
            pronoun: '',
            gender: 'unknown',
            conjugation: $('.verb-forms-wrap a').eq(1).text().trim()
        }, {
            // form: 'participe passé',
            form: 'par-pas',
            tense: '',
            pronoun: '',
            gender: 'unknown',
            conjugation: $('.verb-forms-wrap a').eq(2).text().trim()
        }
    ]

    // Navigate to Word Reference Conjugation
    const uri2 = `https://www.wordreference.com/conj/FrVerbs.aspx?v=${input.query}`
    const page2 = await browser.newPage()
    await page2.goto(uri2, {
        timeout: 200000,
    })
    html = await page2.content()
    $ = cheerio.load(html)

    // Get verb conjugation list
    // https://www.wordreference.com/conj/FrVerbs.aspx?v=passer
    // NOTE: considered imperatif / feminine / plural forms, (e) / (e)s / (e)(s) / !
    const getConjugations = e => {
        const conj = $(e).find('td').text().replace('!', '').trim()
        // console.log('getConjugation():conj', conj)
        const regex = new RegExp(/(.*?)\(.*/)
        const extracted = regex.exec(conj)
        // extracted === null ? null : console.log('getConjugation():extracted', extracted[1])
        const output = []
        if (!conj.includes('(e)s') && extracted === null) output.push({ conj, gender: 'unknown' })
        // console.log(conj.includes('(e)s'))
        if (conj.includes('(e)(s)') && extracted !== null) {
            output.push({ conj: `${extracted[1]}`, gender: 'unknown' })
            output.push({ conj: `${extracted[1]}e`, gender: 'f' })
            output.push({ conj: `${extracted[1]}s`, gender: 'unknown' })
            output.push({ conj: `${extracted[1]}es`, gender: 'f' })
        }
        if (conj.includes('(e)s') && extracted !== null) {
            output.push({ conj: `${extracted[1]}s`, gender: 'unknown' })
            output.push({ conj: `${extracted[1]}es`, gender: 'f' })
        }
        if (conj.includes('(e)') && extracted !== null) {
            output.push({ conj: `${extracted[1]}`, gender: 'unknown' })
            output.push({ conj: `${extracted[1]}e`, gender: 'f' })
        }
        console.log('getConjugation():output', output)
        return output
    }

    const pronoun = {
        1: '1s',
        2: '2s',
        3: '3s',
        4: '1p',
        5: '2p',
        6: '3p',
    }

    const getForm = form => {
        switch (form) {
            case 'indicatif': return 'ind'
            case 'formes composées / compound tenses': return 'cmp'
            case 'subjonctif': return 'sbj'
            case 'conditionnel': return 'cnd'
            case 'impératif': return 'imp'
            default: return form
        }
    }

    const getTense = tense => {
        switch (tense) {
            case 'présent': return 'pré'
            case 'imparfait': return 'impar'
            case 'passé simple': return 'pas-sim'
            case 'futur simple': return 'fut-sim'
            case 'passé composé': return 'pas-cmp'
            case 'plus-que-parfait': return 'plus-que'
            case 'passé antérieur': return 'pas-ant'
            case 'futur antérieur': return 'fut-ant'
            case 'passé': return 'pas'
            case 'passé II': return 'pasII'
            default: return tense
        }
    }

    // extracting from table
    $('.aa').each((i, elem) => {
        const form = $(elem).find('h4').text().trim()
        // second loop
        $(elem).find('tbody').each((j, elem2) => {
            const tense = $(elem2).find('tr').eq(0).text().trim()
            // third loop
            $(elem2).find('tr').each((k, elem3) => {
                // return array of conjugations with all possibilities
                const conjugations = getConjugations(elem3)
                // console.log('each():conjugations', conjugations)
                // k === 0 : Do not add first <tr> tag that indicates tense
                k === 0 ?
                    null :
                    conjugations.forEach(item => {
                        // only return results if there is an entry, not '–'
                        item.conj === '–' ? null : results.push({
                            form: getForm(form),
                            tense: getTense(tense),
                            pronoun: pronoun[k],
                            gender: item.gender,
                            conjugation: item.conj
                        })
                    })
            })
        })
    })

    // Here's the place for your magic...
    console.log(`Input query: ${input.query}`)
    // console.log('Results: ', results)

    // Store the output
    const output = {
        name: 'apify/igsys/conjugation-wr',
        crawledAt: new Date(),
        input,
        uri,
        results,
    }
    await Apify.setValue('OUTPUT', output)
})
