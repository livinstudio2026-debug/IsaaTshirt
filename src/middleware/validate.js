// Validates params/query/body with zod. Express 5 makes req.query read-only,
// so parsed values are exposed as req.valid.{params,query,body}.
export const validate = (schemas) => (req, _res, next) => {
  req.valid = {}
  for (const part of ['params', 'query', 'body']) {
    if (!schemas[part]) continue
    const result = schemas[part].safeParse(req[part])
    if (!result.success) return next(result.error)
    req.valid[part] = result.data
  }
  next()
}
