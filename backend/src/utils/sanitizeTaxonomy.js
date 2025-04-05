function sanitizeTaxonomy(rawTaxonomy) {
    // Remove leading characters like digits, punctuation, underscores, dashes, etc.
    let cleaned = rawTaxonomy.replace(/^[\d\.\s_-]+/, "").trim();
    // In case the response spans multiple lines, take only the first line
    cleaned = cleaned.split("\n")[0].trim();
    return cleaned;
}

export default sanitizeTaxonomy;