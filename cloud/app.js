
// These two lines are required to initialize Express in Cloud Code.
var express = require('express');
var ejs = require('ejs');
var parseExpressHttpsRedirect = require('parse-express-https-redirect');
var parseExpressCookieSession = require('parse-express-cookie-session');
var app = express();

// Filters
ejs.filters.fancy_time = function(date) {
    var diff = new Date().getTime() / 1000 - date.getTime() / 1000;
    if (diff < 3600) {
        return "less than an hour ago";
    } else if (diff < 86400) {
        var time = Math.floor(diff / 3600);
        if (time == 1) {
            return time + " hour ago";
        }
        return time + " hours ago";
    }
    return Math.floor(diff / 86400) + " days ago";
};

ejs.filters.location = function(arg) {
    return app.locals.location;
};

// Global app configuration section
app.set('views', 'cloud/views');  // Specify the folder to find templates
app.set('view engine', 'ejs');    // Set the template engine
app.use(express.bodyParser());    // Middleware for reading request body
app.use(parseExpressHttpsRedirect());  // Require user to be on HTTPS.
app.use(express.cookieParser('e7879adee1ee6c10fc424661d373c4be'));
app.use(parseExpressCookieSession({ cookie: { maxAge: 3600000 } }));
app.use(express.cookieSession());

var HANDLES = ["Iamlorde", "ForGondor", "GonnaBeAlright", "Chicken", "NotInKansas", "YakkityYak", "ChuckLee", "BruceNorris", "WhiteJack", "JackBlack"];

app.set('location', "cornell");

app.get('/welcome', function(req, res) {
    res.render('sign_in', { } );
});

app.get('/registered', function(req, res) {
    res.redirect('/welcome', { } );
});

app.post('/generate_id', function(req, res) {
    req.session.userID = HANDLES[Math.floor(Math.random()*HANDLES.length)] +
                            Math.floor(Math.random()*100);
    res.render('registered', { userID: req.session.userID });
});

app.get('/', function(req, res) {
    if (!req.session.userID) {
        res.render('sign_in', { });
        return;
    }
    req.session.sortBy = "new";
    var postsObject = Parse.Object.extend("posts");
    var query = new Parse.Query(postsObject);
    query.descending("createdAt");
    query.find({
      success: function(postList) {
        res.render('posts_list', { type: "sortNew", posts: postList, userID: req.session.userID } );
      },
      error: function(error) {
        res.render('posts_list', { type: "sortNew", posts: [] } );
      }
    });
});

app.get('/hot', function(req, res) {
    if (!req.session.userID) {
        res.render('sign_in', { });
        return;
    }
    req.session.sortBy = "hot";
    var postsObject = Parse.Object.extend("posts");
    var query = new Parse.Query(postsObject);
    query.descending("likes");
    query.find({
      success: function(postList) {
        res.render('posts_list', { type: "sortHot", posts: postList, userID: req.session.userID } );
      },
      error: function(error) {
        res.render('posts_list', { type: "sortHot", posts: [] } );
      }
    });
});

app.get('/new_post', function(req, res) {
    res.render('new_post', { userID: req.session.userID } );
});

app.post('/new_post', function(req, res) {
    var text = req.body.text;
    if (text == "") {
        res.redirect('/new_post');
        return;
    }
    var postsObject = Parse.Object.extend("posts");
    var newPost = new postsObject();
    newPost.set("location", "cornell");
    newPost.set("text", text);
    newPost.set("userID", req.session.userID);
    newPost.set("likes", 0);
    newPost.set("likeList", []);
    newPost.set("replies", []);
    newPost.save(null, {
        success: function(newPost) {
            // Execute any logic that should take place after the object is saved.
            alert('New object created with objectId: ');
            res.redirect('/');
            return;
        },
        error: function(newPost, error) {
            // Execute any logic that should take place if the save fails.
            // error is a Parse.Error with an error code and message.
            alert('Failed to create new object, with error code: ' + error.message);
            res.redirect('/');
            return;
        }
    });
});

app.get('/like/:id', function(req, res) {
    var postsObject = Parse.Object.extend("posts");
    var query = new Parse.Query(postsObject);
    query.get(req.params.id, {
        success: function(post) {
            post.save(null, {
                success: function(postUpdated) {
                    var likes = postUpdated.get('likes');
                    postUpdated.set("likes", likes + 1);
                    postUpdated.add("likeList", req.session.userID);
                    postUpdated.save();
                    
                    var sortBy = "/";
                    if (req.session.sortBy && req.session.sortBy == "hot") {
                        sortBy = "/hot";
                    }
                    res.redirect(sortBy);
                    return;
                }
            });
        },
        error: function(post, error) {
            res.redirect('/');
            return
        }
    });
});

app.get('/like_post/:id', function(req, res) {
    var postsObject = Parse.Object.extend("posts");
    var query = new Parse.Query(postsObject);
    var postId = req.params.id;
    query.get(postId, {
        success: function(post) {
            post.save(null, {
                success: function(postUpdated) {
                    var likes = postUpdated.get('likes');
                    postUpdated.set("likes", likes + 1);
                    postUpdated.add("likeList", req.session.userID);
                    postUpdated.save();
                    res.redirect('/post_view/'+postId);
                    return;
                }
            });
        },
        error: function(post, error) {
            res.redirect('/post_view/'+postId);
            return
        }
    });
});

app.get('/comment_like/:id', function(req, res) {
    var postsObject = Parse.Object.extend("replies");
    var query = new Parse.Query(postsObject);
    var postId = req.params.id;
    query.get(postId, {
        success: function(reply) {
            reply.save(null, {
                success: function(replyUpdated) {
                    var postId = replyUpdated.get('parentId');
                    var likes = replyUpdated.get('likes');
                    replyUpdated.set("likes", likes + 1);
                    replyUpdated.add("likeList", req.session.userID);
                    replyUpdated.save();
                    res.redirect('/post_view/'+postId);
                    return;
                }
            });
        },
        error: function(reply, error) {
            res.redirect('/');
            return
        }
    });
});

app.get('/post_view/:id', function(req, res) {
    var postsObject = Parse.Object.extend("posts");
    var query = new Parse.Query(postsObject);
    query.include("replies");
    query.get(req.params.id, {
        success: function(post) {
            var replies = post.get("replies");
            res.render('post_view', { post: post, replies: replies, userID: req.session.userID } );
        },
        error: function(post, error) {
            res.redirect('/');
            return
        }
    });
});

app.post('/new_reply/:id', function(req, res) {
    var text = req.body.text;
    var postsObject = Parse.Object.extend("posts");
    var query = new Parse.Query(postsObject);
    var postId = req.params.id;
    query.get(postId, {
        success: function(post) {
            var repliesObject = Parse.Object.extend("replies");
            var newReply = new repliesObject();
            newReply.set("location", app.locals.location);
            newReply.set("text", text);
            newReply.set("userID", req.session.userID);
            newReply.set("likes", 0);
            newReply.set("likeList", []);
            newReply.set("parentId", postId);
            post.add("replies", newReply);
            post.save(null, {
                success: function(postUpdated) {
                    postUpdated.save();
                    res.redirect('/post_view/' + postId);
                    return;
                }
            });
        },
        error: function(post, error) {
            res.redirect('/');
            return
        }
    });
});

app.get('/previous_post/:id', function(req, res) {
    var postId = req.params.id;
    var sortBy = "createdAt";
    if (req.session.sortBy && req.session.sortBy == "hot") {
        sortBy = "likes";
    }
    var postsObject = Parse.Object.extend("posts");
    var query = new Parse.Query(postsObject);
    query.descending(sortBy);
    query.find({
      success: function(postList) {
        var nextId;
        for (var i = 0; i < postList.length; i++) {
            if (!nextId) {
                nextId = postList[i].id;
            }
            if (postList[i].id == postId && i > 0) {
                nextId = postList[i-1].id;
                break;
            }
        }
        res.redirect('/post_view/' + nextId);
      },
      error: function(error) {
        res.redirect('/', { } );
      }
    });
});

app.get('/next_post/:id', function(req, res) {
    var postId = req.params.id;
    var sortBy = "createdAt";
    if (req.session.sortBy && req.session.sortBy == "hot") {
        sortBy = "likes";
    }
    var postsObject = Parse.Object.extend("posts");
    var query = new Parse.Query(postsObject);
    query.descending(sortBy);
    query.find({
      success: function(postList) {
        var nextId;
        for (var i = 0; i < postList.length; i++) {
            if (postList[i].id == postId && i < postList.length - 1) {
                nextId = postList[i+1].id;
                break;
            }
        }
        if (!nextId) {
            nextId = postList[postList.length-1].id;
        }
        res.redirect('/post_view/' + nextId);
      },
      error: function(error) {
        res.redirect('/', { } );
      }
    });
});



// app.post('/register', function(req, res) {
//     if (Parse.User.current()) {
//         res.redirect('/accounts');  // Someone is already logged in
//         return;
//     }
//     // Catch any missing requirements
//     var errorMsg = null;
//     if (!req.body.username) {
//         errorMsg = 'Username is required';
//     } else if (!req.body.password) {
//         errorMsg = 'Password is required';
//     } else if (!req.body.email) {
//         errorMsg = 'Email is required';
//     }
//     if (errorMsg) {
//         res.render('register', { error: errorMsg } );
//         return;
//     }

//     // Use Parse to register a new user
//     var user = new Parse.User();
//     user.set("username", req.body.username);
//     user.set("password", req.body.password);
//     user.set("email", req.body.email);
     
//     user.signUp(null, {
//       success: function(user) {
//         // Let them use the app now.
//         user.setACL(new Parse.ACL(user));
//         user.save(null, {
//             success: function(user) {
//                 Parse.User.logIn(req.body.username, req.body.password, {
//                     success: function(user) {
//                         // Successful login.
//                         res.redirect('/accounts');
//                     },
//                     error: function(user, error) {
//                         console.log(error.message);
//                         res.render('register', { error: error.message } );
//                     }
//                 });
//             },
//             error: function(error) {
//                 console.log(error.message);
//                 res.render('register', { error: error.message } );
//             }
//         });
//       },
//       error: function(user, error) {
//         // Show the error message somewhere and let the user try again.
//         res.render('register', { error: error.message } );
//       }
//     });
// });


// app.get('/login', function(req, res) {
//     if (!Parse.User.current()) {
//         // No user is logged in
//         res.render('login', {} );
//     } else {
//         // User is already logged in
//         res.redirect('/accounts');
//     }
// });


// app.post('/login', function(req, res) {
//     // Use Parse to log in
//     Parse.User.logIn(req.body.username, req.body.password).then(
//     function() {
//         // Login succeeded, redirect to list of accounts.
//         res.redirect('/accounts');
//     },
//     function(error) {
//         // Login failed, redirect back to login form.
//         res.redirect('/login');
//     });
// });


// app.get('/logout', function(req, res) {
//     // Log the user out, then redirect to login page
//     Parse.User.logOut();
//     res.redirect('/login');
// });


// app.get('/accounts', function(req, res) {
//     if (!Parse.User.current()) {
//         res.redirect('/login');  // No user is logged in
//         return;
//     }
//     Parse.User.current().fetch().then(function(user) {
//         // Render the user profile information
//         var usrAccounts = user.get('accounts');
//         if (!usrAccounts || usrAccounts.length < 1) {
//             res.render('accounts', { accounts: [] } );
//         } else {
//             Parse.Object.fetchAll(usrAccounts, {
//                 success: function(list) {
//                     // All the objects were fetched.
//                     res.render('accounts', { accounts: list } );
//                 },
//                 error: function(error) {
//                     // An error occurred while fetching one of the objects.
//                     res.render('accounts', { accounts: [] } );
//                 },
//             });
//         }
//     },
//     function(error) {
//         // Render error page.
//         console.log(error.message);
//     });
// });

// app.get('/update', function(req, res) {
//     if (!Parse.User.current()) {
//         res.redirect('/login');  // No user is logged in
//     } else {
//         res.render('update', { error: null } );
//     }
// });


// app.post('/update_account', function(req, res) {
//     if (!Parse.User.current()) {
//         res.redirect('/login');  // No user is logged in
//         return;
//     }
//     // Catch any missing requirements
//     var errorMsg = null;
//     if (!req.body.accountType) {
//         errorMsg = 'Account Type is required';
//     } else if (!req.body.username) {
//         errorMsg = 'Username is required';
//     } else if (!req.body.password) {
//         errorMsg = 'Password is required';
//     }
//     if (errorMsg) {
//         res.render('update', { error: errorMsg } );
//         return;
//     }

//     // Declare the Object type
//     var Account = Parse.Object.extend('Account');

//     var usrAccount = new Account();
//     usrAccount.set('type', req.body.accountType);
//     usrAccount.set('username', req.body.username);
//     usrAccount.set('password', req.body.password);

//     // Ensure this data is not open to the public, but to this user
//     usrAccount.setACL(new Parse.ACL(Parse.User.current()));

//     Parse.User.current().fetch().then(function(user) {
//         user.add('accounts', usrAccount);
//         user.save(null, {
//             success: function(user) {
//                 res.redirect('/accounts');
//             },
//             error: function(error) {
//                 console.log(error.message);
//                 res.render('update', { error: error.message } );
//             }
//         });
//     },
//     function(error) {
//         // Render error page.
//         console.log(error.message);
//         res.render('update', { error: error.message } );
//     });
// });


// Attach the Express app to Cloud Code.
app.listen();
