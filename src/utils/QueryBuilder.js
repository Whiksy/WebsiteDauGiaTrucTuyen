/**
 * Query Builder - Lớp tiện ích chuẩn OOP để xây dựng truy vấn SQL động
 * Giúp loại bỏ việc nối chuỗi (String concatenation) thủ công rườm rà trong Repository.
 */
class QueryBuilder {
  constructor(baseTable) {
    this.baseTable = baseTable;
    this.selectFields = '*';
    this.joins = [];
    this.conditions = [];
    this.params = {};
    this.orderByClause = '';
    this.limitClause = '';
  }

  select(fields) {
    this.selectFields = fields;
    return this;
  }

  join(joinClause) {
    this.joins.push(joinClause);
    return this;
  }

  // So sánh bằng (=)
  whereEquals(field, value, paramName = field.replace(/\./g, '_')) {
    if (value !== undefined && value !== null && value !== '') {
      this.conditions.push(`${field} = @${paramName}`);
      this.params[paramName] = value;
    }
    return this;
  }

  // Tìm kiếm chuỗi (LIKE) hỗ trợ nhiều cột
  whereLike(fields, value, paramName = 'searchTerm') {
    const fieldsArray = Array.isArray(fields) ? fields : [fields];
    const likeConditions = fieldsArray.map(f => `${f} LIKE @${paramName}`).join(' OR ');
    this.conditions.push(`(${likeConditions})`);
    this.params[paramName] = `%${value || ''}%`;
    return this;
  }

  // Lớn hơn hoặc bằng (>=)
  whereGreaterThanOrEqual(field, value, paramName = field.replace(/\./g, '_') + '_min') {
    if (value !== undefined && value !== null && value !== '') {
      this.conditions.push(`${field} >= @${paramName}`);
      this.params[paramName] = value;
    }
    return this;
  }

  // Nhỏ hơn hoặc bằng (<=)
  whereLessThanOrEqual(field, value, paramName = field.replace(/\./g, '_') + '_max') {
    if (value !== undefined && value !== null && value !== '') {
      this.conditions.push(`${field} <= @${paramName}`);
      this.params[paramName] = value;
    }
    return this;
  }

  orderBy(field, direction = 'DESC') {
    this.orderByClause = `ORDER BY ${field} ${direction}`;
    return this;
  }

  paginate(limit, offset) {
    this.limitClause = `LIMIT @limit OFFSET @offset`;
    this.params['limit'] = Number(limit);
    this.params['offset'] = Number(offset);
    return this;
  }

  // Xuất ra truy vấn SQL và tự động nhúng biến vào DBRequest
  build(dbRequest) {
    let query = `SELECT ${this.selectFields} FROM ${this.baseTable}`;

    if (this.joins.length > 0) query += ' ' + this.joins.join(' ');
    if (this.conditions.length > 0) query += ' WHERE ' + this.conditions.join(' AND ');
    if (this.orderByClause) query += ' ' + this.orderByClause;
    if (this.limitClause) query += ' ' + this.limitClause;

    // Gắn tham số vào request
    Object.entries(this.params).forEach(([key, value]) => {
      dbRequest.input(key, value);
    });

    return query;
  }
}

module.exports = QueryBuilder;