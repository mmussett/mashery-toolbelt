const PATTERN_MATCH = /(\*)/
const ESCAPE_REGEXP = /[().-]/g
const SPLIT_PATTERN = /[^\\]:/
const LEFT_BRACKETS = /[[(]/g
const RIGHT_BRACKETS = /[\])]/g

function validatePatterns (value, name, required) {
  if (Array.isArray(value)) {
    value = value.filter(val => typeof val === 'string' && val.length)
  } else {
    value = typeof value === 'string' && value.length ? [value] : []
  }

  if (required === true && value.length === 0) {
    const nameText = name ? `'${name}' ` : ''
    throw new Error(`Replacer ${nameText}can't be empty`)
  }

  return value
}

function ident (value) {
  return value
}

function patternsToReplacers (patterns) {
  return patterns.map(pattern => {
    let from = pattern
    let to

    const match = pattern.match(SPLIT_PATTERN)

    if (match) {
      from = pattern.slice(0, match.index + 1)
      to = pattern.slice(match.index + 2)
    }

    const isPattern = from.includes('*')

    const fromParts = from.split(PATTERN_MATCH)
    const toParts = to && to.split(PATTERN_MATCH)

    if (isPattern && toParts && fromParts.length !== toParts.length) {
      throw new Error(
        `pattern '${pattern}': source and target pattern has different count of components`
      )
    }

    if (!to) {
      if (patterns.length > 1) {
        throw new Error(
          `There can be only single replace value pattern. Instead ${
            patterns.length
          } patterns presented`
        )
      }

      return {
        type: 'simple',
        replaceWith: from.replace('\\:', ':')
      }
    }

    if (!isPattern) {
      return {
        type: 'multi',
        match: from,
        replaceWith: to
      }
    }

    const regexp = fromParts
      .map(
        part =>
          part === '*'
            ? '(.*?)'
            : part
              .replace(LEFT_BRACKETS, '(')
              .replace(RIGHT_BRACKETS, ')')
              .replace(ESCAPE_REGEXP, '\\$&')
      )
      .join('')

    return {
      type: 'pattern',
      match: new RegExp(`^${regexp}$`),
      replaceWith: match => {
        let matchIndex = 0

        return toParts
          .map(part => (part === '*' ? match[++matchIndex] : part))
          .join('')
      }
    }
  })
}

function makeReplacer (patterns, { name, required = true } = {}) {
  patterns = validatePatterns(patterns, name, required)

  if (patterns.length === 0) {
    return ident
  }

  const replacers = patternsToReplacers(patterns)

  return function (value) {
    if (value && value.length) {
      value = value.replace(LEFT_BRACKETS, '(').replace(RIGHT_BRACKETS, ')')
    }

    let newValue

    replacers.find(({ type, match, replaceWith }) => {
      if (type === 'simple') {
        newValue = replaceWith
        return true
      }

      if (type === 'multi') {
        if (value === match) {
          newValue = replaceWith
          return true
        }
      }

      if (type === 'pattern') {
        const matchResult = value.match(match)

        if (matchResult) {
          newValue = replaceWith(matchResult)
          return true
        }
      }
    })

    if (newValue) {
      return newValue
    }

    if (!required) {
      return value
    }

    throw new Error(
      `Can't match value '${value}' with patterns\n${patterns.join('\n')}`
    )
  }
}

module.exports = makeReplacer
