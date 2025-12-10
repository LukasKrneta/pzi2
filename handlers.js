const sqlite = require("node:sqlite");
const crypto = require("node:crypto");

const db = new sqlite.DatabaseSync("./pzi2.sqlite");

let sessions = [];

// -----------------------------------------------------------
// LOGIN
// -----------------------------------------------------------

function POSTlogin(request, response, params) {
  let username = params["username"];
  let password = params["password"];
  if (username == null || password == null) {
    response.writeHead(400, "Bad request");
    response.end();
    return true;
  }
  let sql = `SELECT username,password,rola 
            FROM users join roles on users.id=roles.user_id
            where username=:username and password=:password`;
  let stmt = db.prepare(sql);
  let users = stmt.all(params);
  if (
    users.length == 0 ||
    (users.length > 0 && users[0].password != password)
  ) {
    response.writeHead(403, "Nepoznat korisnik");
    response.end();
    return true;
  }
  rola = users[0].rola;
  let uuid = crypto.randomUUID();
  let session = {
    id: uuid,
    username: username,
    rola: rola,
  };
  sessions.push(session);
  let headers = {};
  headers["AUTH"] = uuid;
  response.writeHead(200, headers);
  response.end();
  return true;
}

// -----------------------------------------------------------
// USER HELPERS
// -----------------------------------------------------------

function authUser(request, response) {
  let auth = request.headers["auth"];
  if (auth == null) {
    response.writeHead(403, "Ferboten!");
    response.end();
    return null;
  }
  let user = sessions.find((s) => s.id == auth);
  if (user == null) {
    response.writeHead(403, "Ferboten!");
    response.end();
    return null;
  }
  return user;
}

// -----------------------------------------------------------
// USERS HANDLERS
// -----------------------------------------------------------

function GETusers(request, response, params) {
  let auth = request.headers["auth"];
  if (auth == null) {
    response.writeHead(403, "Ferboten!");
    response.end();
    return true;
  }
  let user = sessions.find((s) => s.id == auth);
  if (user == null) {
    response.writeHead(403, "Ferboten!");
    response.end();
    return true;
  }

  let id = params["id"];
  let users = [];
  if (id != null) {
    let stmt = db.prepare("select * from users where id=:id");
    users = stmt.all(params);
  } else {
    let stmt = db.prepare("select * from users");
    users = stmt.all();
  }

  let headers = {};
  headers["Content-Type"] = "application/json; charset=UTF-8";
  response.writeHead(200, headers);
  response.write(JSON.stringify(users));
  response.end();
  return true;
}

function POSTusers(request, response, params) {
  let username = params["username"];
  let password = params["password"];
  if (username == "" || password == "") {
    response.writeHead(400, "Bad request");
    response.end();
    return true;
  }

  let novi = {
    username: username,
    password: password,
  };
  let stmt = db.prepare(
    "insert into users (username,password) values (:username,:password)"
  );
  let ret = stmt.run(params);
  novi["id"] = ret.lastInsertRowid;

  let headers = {};
  headers["Content-Type"] = "application/json; charset=UTF-8";
  response.writeHead(200, headers);
  response.write(JSON.stringify(novi));
  response.end();
  return true;
}

function DELETEusers(request, response, params) {
  let auth = request.headers["auth"];
  if (auth == null) {
    response.writeHead(403, "Ferboten!");
    response.end();
    return true;
  }
  let user = sessions.find((s) => s.id == auth);
  if (user == null) {
    response.writeHead(403, "Ferboten!");
    response.end();
    return true;
  }
  if (user.rola != "super") {
    response.writeHead(403, "Ferboten!");
    response.end();
    return true;
  }

  let id = params["id"];

  if (id == null) {
    response.writeHead(406, headers);
    response.end();
    return true;
  }

  let pars = { id: id };
  let stmt = db.prepare("delete from users where id=:id");
  let ret = stmt.run(pars);

  let headers = {};
  headers["Content-Type"] = "text/plain; charset=utf-8";
  if (ret.changes == 0) {
    response.writeHead(406, headers);
  } else {
    response.writeHead(200, headers);
    response.write("deleted id: " + params["id"] + "\n");
  }
  response.end();
  return true;
}

function PUTusers(request, response, params) {
  let headers = {};
  headers["Content-Type"] = "text/plain; charset=utf-8";
  response.writeHead(200, headers);
  response.write("username: " + params.username + "\n");
  response.write("password: " + params.password + "\n");
  response.end();
  return true;
}

// -----------------------------------------------------------
// TODO HANDLERS
// -----------------------------------------------------------

// GET /todos   OR   GET /todos?id=#
function GETtodos(request, response, params) {
  let sessionUser = authUser(request, response);
  if (!sessionUser) return true;

  let todos = [];
  if (params.id != null) {
    let stmt = db.prepare(
      "SELECT * FROM todos WHERE id=:id AND user_id=(SELECT id FROM users WHERE username=:username)"
    );
    todos = stmt.all({ id: params.id, username: sessionUser.username });
  } else {
    let stmt = db.prepare(
      "SELECT * FROM todos WHERE user_id=(SELECT id FROM users WHERE username=:username)"
    );
    todos = stmt.all({ username: sessionUser.username });
  }

  let headers = {};
  headers["Content-Type"] = "application/json; charset=UTF-8";
  response.writeHead(200, headers);
  response.write(JSON.stringify(todos));
  response.end();
  return true;
}

// POST /todos   (text=...)
function POSTtodos(request, response, params) {
  let sessionUser = authUser(request, response);
  if (!sessionUser) return true;

  if (!params.text || params.text.trim() === "") {
    response.writeHead(400, "Bad request");
    response.end();
    return true;
  }

  // find user id
  let userStmt = db.prepare("SELECT id FROM users WHERE username=:username");
  let userRow = userStmt.get({ username: sessionUser.username });

  let stmt = db.prepare(
    "INSERT INTO todos (user_id, text) VALUES (:user_id, :text)"
  );
  let ret = stmt.run({ user_id: userRow.id, text: params.text });

  let newTodo = {
    id: ret.lastInsertRowid,
    user_id: userRow.id,
    text: params.text,
    done: 0,
  };

  let headers = {};
  headers["Content-Type"] = "application/json; charset=UTF-8";
  response.writeHead(200, headers);
  response.write(JSON.stringify(newTodo));
  response.end();
  return true;
}

// PUT /todos   (id=..., text=?, done=?)
function PUTtodos(request, response, params) {
  let sessionUser = authUser(request, response);
  if (!sessionUser) return true;

  if (!params.id) {
    response.writeHead(400, "Bad request");
    response.end();
    return true;
  }

  let fields = [];
  let bind = { id: params.id };

  if (params.text != null) {
    fields.push("text=:text");
    bind.text = params.text;
  }
  if (params.done != null) {
    fields.push("done=:done");
    bind.done = params.done ? 1 : 0;
  }

  if (fields.length === 0) {
    response.writeHead(400, "Nothing to update");
    response.end();
    return true;
  }

  let sql =
    "UPDATE todos SET " +
    fields.join(",") +
    " WHERE id=:id AND user_id=(SELECT id FROM users WHERE username=:username)";

  bind.username = sessionUser.username;

  let stmt = db.prepare(sql);
  stmt.run(bind);

  response.writeHead(200, { "Content-Type": "text/plain; charset=utf-8" });
  response.write("updated id: " + params.id);
  response.end();
  return true;
}

// DELETE /todos?id=#
function DELETEtodos(request, response, params) {
  let sessionUser = authUser(request, response);
  if (!sessionUser) return true;

  if (!params.id) {
    response.writeHead(400, "Bad request");
    response.end();
    return true;
  }

  let stmt = db.prepare(
    "DELETE FROM todos WHERE id=:id AND user_id=(SELECT id FROM users WHERE username=:username)"
  );
  let ret = stmt.run({ id: params.id, username: sessionUser.username });

  let headers = {};
  headers["Content-Type"] = "text/plain; charset=utf-8";
  if (ret.changes == 0) response.writeHead(406, headers);
  else response.writeHead(200, headers);

  response.write("deleted id: " + params.id);
  response.end();
  return true;
}

// -----------------------------------------------------------
// HANDLER MAP
// -----------------------------------------------------------

let handlers = new Map();
handlers.set("GET /users", GETusers);
handlers.set("POST /users", POSTusers);
handlers.set("PUT /users", PUTusers);
handlers.set("DELETE /users", DELETEusers);
handlers.set("POST /login", POSTlogin);

// NEW TODO ENDPOINTS
handlers.set("GET /todos", GETtodos);
handlers.set("POST /todos", POSTtodos);
handlers.set("PUT /todos", PUTtodos);
handlers.set("DELETE /todos", DELETEtodos);

module.exports = handlers;
