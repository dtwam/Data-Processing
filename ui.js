
var CSim = (function(){
  var MAX_STMTS = 300000;
  var MAX_DEPTH = 400;

  function tokenize(src){
    var toks=[], i=0, line=1;
    function isId(c){ return /[A-Za-z_]/.test(c); }
    function isIdN(c){ return /[A-Za-z0-9_]/.test(c); }
    function isDig(c){ return /[0-9]/.test(c); }
    while(i<src.length){
      var c=src[i];
      if(c==="\n"){ line++; i++; continue; }
      if(c===" "||c==="\t"||c==="\r"){ i++; continue; }
      if(c==="/"&&src[i+1]==="/"){ while(i<src.length&&src[i]!=="\n")i++; continue; }
      if(c==="/"&&src[i+1]==="*"){ i+=2; while(i<src.length&&!(src[i]==="*"&&src[i+1]==="/")){ if(src[i]==="\n")line++; i++; } i+=2; continue; }
      if(c==="#"){ while(i<src.length&&src[i]!=="\n")i++; continue; }
      if(c==='"'){
        var s=""; i++;
        while(i<src.length&&src[i]!=="\""){
          var ch=src[i];
          if(ch==="\\"){ var n=src[i+1]; s += n==="n"?"\n":n==="t"?"\t":n==="\\"?"\\":n===undefined?"":n; i+=2; }
          else { s+=ch; i++; }
        }
        i++; toks.push({t:"str", v:s, line:line}); continue;
      }
      if(c==="'"){
        var s2=""; i++;
        if(src[i]==="\\"){ s2 += src[i+1]==="n"?"\n":src[i+1]==="t"?"\t":src[i+1]; i+=2; } else { s2+=src[i]; i++; }
        if(src[i]==="'") i++; toks.push({t:"str", v:s2, line:line, isChar:true}); continue;
      }
      if(isDig(c)||(c==="."&&isDig(src[i+1]))){
        var num="", isF=false;
        if(c==="."){ isF=true; num+="0."; i++; while(i<src.length&&isDig(src[i])){num+=src[i];i++;} }
        else{
          while(i<src.length&&isDig(src[i])){num+=src[i];i++;}
          if(src[i]==="."){ isF=true; num+="."; i++; while(i<src.length&&isDig(src[i])){num+=src[i];i++;} }
        }
        toks.push({t:"num", v:isF?parseFloat(num):parseInt(num,10), isFloat:isF, line:line}); continue;
      }
      if(isId(c)){
        var id=""; while(i<src.length&&isIdN(src[i])){id+=src[i];i++;}
        toks.push({t:"id", v:id, line:line}); continue;
      }
      var two=src.substr(i,2);
      var ops=["==","!=","<=",">=","&&","||","+=","-=","*=","/=","%=","++","--"];
      if(ops.indexOf(two)>=0){ toks.push({t:"op", v:two, line:line}); i+=2; continue; }
      if("=+-*/%<>!".indexOf(c)>=0){ toks.push({t:"op", v:c, line:line}); i++; continue; }
      if("(){}[];,".indexOf(c)>=0){ toks.push({t:c, line:line}); i++; continue; }
      i++;
    }
    toks.push({t:"eof", line:line});
    return toks;
  }

  function parse(src){
    var toks=tokenize(src), p=0;
    // إلحاق تلقائي داخل main() للقطع البرمجية غير المكتملة (كتدريب)
    if(!(isTypeTok(toks[0]) && toks[1] && toks[1].t==="id" && toks[2] && toks[2].t==="(")){
      var inner=toks.filter(function(t){ return t.t!=="eof"; });
      toks=[];
      toks.push({t:"id", v:"void", line:1},{t:"id", v:"main", line:1},{t:"(", line:1},{t:")", line:1});
      toks.push({t:"{", line:1});
      Array.prototype.push.apply(toks, inner);
      toks.push({t:"}", line:1},{t:"eof", line:1});
    }
    function peek(o){ return toks[p+(o||0)]; }
    function next(){ return toks[p++]; }
    function cur(){ return toks[p]; }
    function isTypeTok(t){ return t&&t.t==="id"&&["int","float","char","void"].indexOf(t.v)>=0; }
    function expect(t){ var k=next(); if(k.t!==t) throw {msg:"خطأ في الصيغة: متوقع '"+t+"' عند السطر "+(k?k.line:"")}; return k; }
    function expectOp(v){ var k=next(); if(k.t!=="op"||k.v!==v) throw {msg:"خطأ في الصيغة: متوقع '"+v+"'"}; return k; }
    function expectId(){ var k=next(); if(k.t!=="id") throw {msg:"خطأ في الصيغة: متوقع اسمًا"}; return k; }

    // تعبيرات
    function expr(){ return assign(); }
    function assign(){
      var l=cond();
      var k=peek();
      if(k&&k.t==="op"&&["=","+=","-=","*=","/=","%="].indexOf(k.v)>=0){
        next(); var rhs=assign();
        return {kind:"assign", lhs:l, op:k.v, rhs:rhs, line:k.line};
      }
      return l;
    }
    function cond(){ return orExpr(); }
    function orExpr(){
      var l=andExpr();
      while(peek()&&peek().t==="op"&&peek().v==="||"){ var k=next(); var r=andExpr(); l={kind:"bin", op:"||", a:l, b:r, line:k.line}; }
      return l;
    }
    function andExpr(){
      var l=eqExpr();
      while(peek()&&peek().t==="op"&&peek().v==="&&"){ var k=next(); var r=eqExpr(); l={kind:"bin", op:"&&", a:l, b:r, line:k.line}; }
      return l;
    }
    function eqExpr(){
      var l=relExpr();
      while(peek()&&peek().t==="op"&&(peek().v==="=="||peek().v==="!=")){ var k=next(); var r=relExpr(); l={kind:"bin", op:k.v, a:l, b:r, line:k.line}; }
      return l;
    }
    function relExpr(){
      var l=addExpr();
      while(peek()&&peek().t==="op"&&["<",">","<=",">="].indexOf(peek().v)>=0){ var k=next(); var r=addExpr(); l={kind:"bin", op:k.v, a:l, b:r, line:k.line}; }
      return l;
    }
    function addExpr(){
      var l=mulExpr();
      while(peek()&&peek().t==="op"&&(peek().v==="+"||peek().v==="-")){ var k=next(); var r=mulExpr(); l={kind:"bin", op:k.v, a:l, b:r, line:k.line}; }
      return l;
    }
    function mulExpr(){
      var l=unary();
      while(peek()&&peek().t==="op"&&["*","/","%"].indexOf(peek().v)>=0){ var k=next(); var r=unary(); l={kind:"bin", op:k.v, a:l, b:r, line:k.line}; }
      return l;
    }
    function unary(){
      var k=peek();
      if(k&&k.t==="op"&&(k.v==="-"||k.v==="!")){ next(); var c=unary(); return {kind:"un", op:k.v, a:c, line:k.line}; }
      if(k&&k.t==="op"&&(k.v==="++"||k.v==="--")){ next(); var t=postfix(); return {kind:"preinc", op:k.v, target:t, line:k.line}; }
      return postfix();
    }
    function postfix(){
      var b=primary();
      for(;;){
        var k=peek();
        if(k&&k.t==="["){ next(); var ix=expr(); expect("]"); b={kind:"index", base:b, ix:ix, line:k.line}; continue; }
        if(k&&k.t==="op"&&(k.v==="++"||k.v==="--")){ next(); b={kind:"postinc", op:k.v, target:b, line:k.line}; continue; }
        break;
      }
      return b;
    }
    function primary(){
      var k=next();
      if(k.t==="num") return {kind:"num", v:k.v, isFloat:k.isFloat, line:k.line};
      if(k.t==="str") return {kind:"str", v:k.v, isChar:k.isChar, line:k.line};
      if(k.t==="("){ var e=expr(); expect(")"); return e; }
      if(k.t==="id"){
        if(peek()&&peek().t==="("){
          next(); var args=[];
          if(peek()&&peek().t!==")"){ args.push(expr()); while(peek()&&peek().t===","){ next(); args.push(expr()); } }
          expect(")");
          return {kind:"call", name:k.v, args:args, line:k.line};
        }
        return {kind:"ident", name:k.v, line:k.line};
      }
      throw {msg:"قيمة غير متوقعة في التعبير عند السطر "+(k?k.line:"o")};
    }

    // الجمل
    function block(){
      expect("{");
      var stmts=[];
      while(peek()&&peek().t!=="}") stmts.push(stmt());
      expect("}");
      return {kind:"block", stmts:stmts, line:1};
    }
    function decl(){
      var typ=expectId(); var tl=typ.line;
      var vars=[]; var line=tl;
      for(;;){
        var nm=expectId(); var tmp={name:nm.v, type:typ.v, isArr:false, size:0, init:null, line:nm.line};
        if(peek()&&peek().t==="["){ next(); tmp.isArr=true; tmp.size=expr(); expect("]"); }
        if(peek()&&peek().t==="op"&&peek().v==="="){ next();
          if(tmp.isArr){
            expect("{"); tmp.init=[];
            if(peek()&&peek().t!=="}"){ tmp.init.push(expr()); while(peek()&&peek().t===","){ next(); tmp.init.push(expr()); } }
            expect("}");
          } else tmp.init=expr();
        }
        vars.push(tmp);
        if(peek()&&peek().t===","){ next(); continue; }
        break;
      }
      expect(";");
      return {kind:"decl", vars:vars, line:line};
    }
    function ifStmt(){
      var k=next(); if(k.t!=="id"||k.v!=="if") throw {msg:"خطأ في الصيغة: متوقع 'if'"};
      var line=k.line;
      expect("("); var c=expr(); expect(")");
      var t=stmt(), f=null;
      if(peek()&&peek().t==="id"&&peek().v==="else"){ next(); f=stmt(); }
      return {kind:"if", c:c, t:t, f:f, line:line};
    }
    function forStmt(){
      var k=next(); if(k.t!=="id"||k.v!=="for") throw {msg:"خطأ في الصيغة: متوقع 'for'"};
      var line=k.line;
      expect("(");
      var init=null;
      if(peek()&&peek().t!==";"){ var tk=peek(); if(isTypeTok(tk)) init=decl(); else init={kind:"expr", e:expr()}; }
      if(!(init && init.kind==="decl")) expect(";");
      var cond=null;
      if(peek()&&peek().t!==";") cond=expr();
      expect(";");
      var step=null;
      if(peek()&&peek().t!==")") step=expr();
      expect(")");
      var body=stmt();
      return {kind:"for", init:init, cond:cond, step:step, body:body, line:line};
    }
    function whileStmt(){
      var k=next(); if(k.t!=="id"||k.v!=="while") throw {msg:"خطأ في الصيغة: متوقع 'while'"};
      expect("("); var c=expr(); expect(")");
      var body=stmt();
      return {kind:"while", c:c, body:body, line:k.line};
    }
    function doWhile(){
      var k=next(); if(k.t!=="id"||k.v!=="do") throw {msg:"خطأ في الصيغة: متوقع 'do'"};
      var body=stmt();
      var w=next(); if(w.t!=="id"||w.v!=="while") throw {msg:"خطأ في الصيغة: متوقع 'while'"};
      expect("("); var c=expr(); expect(")"); expect(";");
      return {kind:"doWhile", body:body, c:c, line:k.line};
    }
    function printfStmt(){
      var k=next(); if(k.t!=="id"||k.v!=="printf") throw {msg:"خطأ في الصيغة: متوقع 'printf' عند السطر "+(k?k.line:"")};
      expect("("); var fmt=expect("str"); var args=[];
      while(peek()&&peek().t===","){ next(); args.push(expr()); }
      expect(")");
      expect(";");
      return {kind:"printf", fmt:fmt.v, args:args, line:k.line};
    }
    function scanfStmt(){
      var k=next(); if(k.t!=="id"||k.v!=="scanf") throw {msg:"خطأ في الصيغة: متوقع 'scanf' عند السطر "+(k?k.line:"")};
      expect("("); var fmt=expect("str"); var targets=[];
      while(peek()&&peek().t===","){ next();
        if(peek()&&peek().t==="op"&&peek().v==="&"){ next(); var nm=expectId(); targets.push({kind:"ident", name:nm.v, line:nm.line}); }
        else { targets.push(expr()); }
      }
      expect(")");
      expect(";");
      return {kind:"scanf", fmt:fmt.v, targets:targets, line:k.line};
    }
    function stmt(){
      var k=peek();
      if(k.t==="{") return block();
      if(k.t==="id"){
        if(isTypeTok(k)) return decl();
        if(k.v==="if") return ifStmt();
        if(k.v==="for") return forStmt();
        if(k.v==="while") return whileStmt();
        if(k.v==="do") return doWhile();
        if(k.v==="return"){ next(); var e=null; if(peek()&&peek().t!==";") e=expr(); expect(";"); return {kind:"return", e:e, line:k.line}; }
        if(k.v==="break"){ next(); expect(";"); return {kind:"break", line:k.line}; }
        if(k.v==="continue"){ next(); expect(";"); return {kind:"continue", line:k.line}; }
        if(k.v==="printf") return printfStmt();
        if(k.v==="scanf") return scanfStmt();
      }
      var e=expr(); expect(";"); return {kind:"expr", e:e, line:(e.line||1)};
    }

    // البرنامج
var funcs=[];
      while(peek()&&peek().t!=="eof"){
        var typ=expectId(); var nm=expectId(); expect("(");
        var params=[]; var tl2=nm.line;
        if(isTypeTok(peek())){
          var pt1=expectId(); var pn1=expectId(); params.push({name:pn1.v, type:pt1.v});
          while(peek()&&peek().t===","){ next(); var pt=expectId(); var pn=expectId(); params.push({name:pn.v, type:pt.v}); }
        }
        expect(")");
        var body=block();
        funcs.push({name:nm.v, retType:typ.v, params:params, body:body, line:tl2});
      }
      return funcs;
  }

  /* ---------- بيئة التنفيذ ---------- */
  function Scope(parent){ this.parent=parent||null; this.vars={}; }
  Scope.prototype.find=function(nm){
    var s=this;
    while(s){ if(nm in s.vars) return s.vars[nm]; s=s.parent; }
    return null;
  };
  Scope.prototype.declare=function(nm, v){ this.vars[nm]=v; };

  function run(code, stdinText, traceMode){
    var outBuffer="";
    var stdinToks = String(stdinText||"").split(/\s+/).filter(function(x){return x.length>0;});
    var funcs;
    try { funcs=parse(code); } catch(e){ return {ok:false, error:(e&&e.msg)||"خطأ في التحليل", output:outBuffer}; }
    if(!funcs||!funcs.length) return {ok:false, error:"لا توجد دوال في الكود", output:outBuffer};
    var fnMap={}, globalScope=new Scope(null);
    funcs.forEach(function(f){ fnMap[f.name]=f; });
    var mainFn=funcs.filter(function(f){return f.name==="main";})[0] || funcs[0];

    var calls=0, sentinel=0, infinity=false;
    var timeline=[];
    var depth=0;
    var scopeStack=[globalScope];

    function varsSnapshot(){
      var into={}, seen={};
      for(var i=scopeStack.length-1;i>=0;i--){
        var sc=scopeStack[i];
        Object.keys(sc.vars||{}).forEach(function(nm){
          if(!seen[nm]){ seen[nm]=true; var v=sc.vars[nm]; into[nm]=fmtVar(v); }
        });
      }
      return into;
    }
    function fmtVar(v){
      if(!v) return "?";
      if(v.isArr){
        return "["+v.arr.join(", ")+"]";
      }
      return v.val;
    }

    function coerce(v, type){
      if(type==="int"){ if(typeof v==="string") return v.length?v.charCodeAt(0):0; return Math.trunc(v); }
      if(type==="float"){ if(typeof v==="string") return v.length?v.charCodeAt(0):0; return v; }
      if(type==="char"){ if(typeof v==="string") return v; if(typeof v==="number") return String.fromCharCode(Math.trunc(v)); return String(v); }
      return v;
    }

    function truthy(x){ if(typeof x.val==="string") return x.val.length>0; return x.val!==0; }

    function evalExpr(e, sc){
      if(!e) return {val:0, type:"int"};
      switch(e.kind){
        case "num": return {val:e.v, type:e.isFloat?"float":"int"};
        case "str": return {val:e.v, type:e.isChar?"char":"string"};
        case "ident": {
          var v=sc.find(e.name);
          if(!v) throw {msg:"متغير غير معرَّف: "+e.name+" (السطر "+e.line+")"};
          if(v.isArr) return {val:v, type:"array"};
          return {val:v.val, type:v.type};
        }
        case "index": {
          var base=evalExpr(e.base, sc); var idx=evalExpr(e.ix, sc);
          if(base.type!=="array") throw {msg:"الفهرس على غير مصفوفة (السطر "+e.line+")"};
          var i=Math.trunc(idx.val);
          if(i<0||i>=base.val.arr.length) throw {msg:"فهرس خارج حدود المصفوفة: "+i+" (السطر "+e.line+")"};
          return {val:base.val.arr[i], type:base.val.type};
        }
        case "call": {
          var f=fnMap[e.name];
          if(!f) throw {msg:"دالة غير معرَّفة: "+e.name+" (السطر "+e.line+")"};
          depth++; calls++;
          if(calls>MAX_STMTS){ infinity=true; depth--; throw {msg:"حد التنفيذ الأقصى — تحقق من الحلقة"}; }
          if(depth>MAX_DEPTH){ depth--; throw {msg:"عمق استدعاء الدوال كبير جداً"}; }
          var local=new Scope(null);
          e.args.forEach(function(a,i){
            var av=evalExpr(a, sc);
            var t=(f.params[i]&&f.params[i].type)||"int";
            local.declare((f.params[i]&&f.params[i].name)||("p"+i), {type:t, val:coerce(av.val,t), isArr:false});
          });
          var retVal={type:"int", val:0};
          try {
            exec(f.body, local, retVal, globalScope);
          } catch(ret){
            if(ret && ret.__ret) retVal={type:ret.type, val:ret.val};
            else throw ret;
          }
          depth--;
          return retVal;
        }
        case "un": {
          var a=evalExpr(e.a, sc);
          if(e.op==="-") return {val:-(a.val), type: typeof a.val==="number"&&a.type==="int"?"int":"float"};
          if(e.op==="!") return {val:truthy(a)?0:1, type:"int"};
          throw {msg:"عملية غير مدعومة"};
        }
        case "bin": {
          return binOp(e, sc);
        }
        case "assign": {
          var rhs=evalExpr(e.rhs, sc);
          var tgt=getLValue(e.lhs, sc);
          var nv=coerce(rhs.val, tgt.type);
          if(e.op==="+=") nv=coerce(tgt.cur + nv, tgt.type);
          else if(e.op==="-=") nv=coerce(tgt.cur - nv, tgt.type);
          else if(e.op==="*=") nv=coerce(tgt.cur * nv, tgt.type);
          else if(e.op==="/="){ if(nv===0) throw {msg:"القسمة على صفر (السطر "+e.line+")"}; nv=coerce(tgt.cur / nv, tgt.type); }
          else if(e.op==="%="){ if(nv===0) throw {msg:"القسمة على صفر (السطر "+e.line+")"}; nv=coerce(Math.trunc(tgt.cur) % Math.trunc(nv), tgt.type); }
          if(e.op && e.op!=="=" && e.op!=="+="&&e.op!=="-="&&e.op!=="*="&&e.op!=="/="&&e.op!=="%=") {}
          tgt.set(nv);
          return {val:nv, type:tgt.type};
        }
        case "preinc": {
          var t2=getLValue(e.target, sc);
          var nv2 = coerce(t2.cur + (e.op==="++"?1:-1), t2.type);
          t2.set(nv2);
          return {val:nv2, type:t2.type};
        }
        case "postinc": {
          var t3=getLValue(e.target, sc);
          var old=t3.cur;
          var nv3 = coerce(old + (e.op==="++"?1:-1), t3.type);
          t3.set(nv3);
          return {val:old, type:t3.type};
        }
      }
      throw {msg:"تعبير غير معروف"};
    }
    function getLValue(e, sc){
      if(e.kind==="ident"){
        var v=sc.find(e.name);
        if(!v){ v={type:"int", val:0, isArr:false}; sc.declare(e.name, v); }
        return {cur:v.isArr?0:v.val, type:v.type, set:function(n){ v.val=coerce(n,v.type); }};
      }
      if(e.kind==="index"){
        var base=evalExpr(e.base, sc);
        if(base.type!=="array") throw {msg:"الفهرس على غير مصفوفة (السطر "+e.line+")"};
        var idx=Math.trunc(evalExpr(e.ix, sc).val);
        if(idx<0||idx>=base.val.arr.length) throw {msg:"فهرس خارج حدود المصفوفة: "+idx+" (السطر "+e.line+")"};
        return {cur:base.val.arr[idx], type:base.val.type, set:function(n){ base.val.arr[idx]=coerce(n, base.val.type); }};
      }
      throw {msg:"الجانب الأيسر ليس متغيراً (السطر "+e.line+")"};
    }
    function asNumber(x){
      if(x.type==="char"||x.type==="string"){ return x.val.length?x.val.charCodeAt(0):0; }
      return x.val;
    }
    function binOp(e, sc){
      var a=evalExpr(e.a, sc), b=evalExpr(e.b, sc);
      var av=asNumber(a), bv=asNumber(b);
      var isInt = a.type==="int"||a.type==="char";
      switch(e.op){
        case "+": return {val: (typeof a.val==="string"&&a.type==="string") ? a.val+b.val : av+bv, type: (isInt&&(b.type==="int"||b.type==="char"))?"int":"float"};
        case "-": return {val:av-bv, type:isInt&&b.type==="int"?"int":"float"};
        case "*": return {val:av*bv, type:isInt&&b.type==="int"?"int":"float"};
        case "/": if(bv===0) throw {msg:"القسمة على صفر (السطر "+e.line+")"}; return {val: (isInt&&b.type==="int") ? Math.trunc(av/bv) : av/bv, type: (isInt&&b.type==="int")?"int":"float"};
        case "%": if(bv===0) throw {msg:"القسمة على صفر (السطر "+e.line+")"}; return {val: Math.trunc(av)%Math.trunc(bv), type:"int"};
        case "<": return {val:av<bv?1:0, type:"int"};
        case ">": return {val:av>bv?1:0, type:"int"};
        case "<=": return {val:av<=bv?1:0, type:"int"};
        case ">=": return {val:av>=bv?1:0, type:"int"};
        case "==": return {val:av===bv?1:0, type:"int"};
        case "!=": return {val:av!==bv?1:0, type:"int"};
        case "&&": return {val:(truthy(a)&&truthy(b))?1:0, type:"int"};
        case "||": return {val:(truthy(a)||truthy(b))?1:0, type:"int"};
      }
      throw {msg:"عملية غير معروفة"};
    }

    function fmtFloat(n){
      if(typeof n!=="number") return String(n);
      if(Number.isInteger(n) && Math.abs(n)<1e15) return String(Math.trunc(n));
      var s=String(n);
      return s;
    }
    function doPrintf(fmt, args, idxRef){
      var out="", ai=0, i=0;
      while(i<fmt.length){
        var ch=fmt[i];
        if(ch==="%"&&i+1<fmt.length){
          var sp=fmt[i+1];
          if(sp==="%"){ out+="%"; i+=2; continue; }
          var arg=args[ai]; ai++;
          if(sp==="d"||sp==="i"){ out += (typeof arg.val==="string") ? String(arg.val.charCodeAt(0)||0) : String(Math.trunc(arg.val)); }
          else if(sp==="f"){ out += fmtFloat(arg.val); }
          else if(sp==="s"){ out += (arg.type==="array") ? arg.val.arr.join("") : String(arg.val); }
          else if(sp==="c"){ out += (typeof arg.val==="string") ? arg.val : String.fromCharCode(Math.trunc(arg.val)); }
          else { out += "%"+sp; }
          i+=2; continue;
        }
        if(ch==="\\"&&fmt[i+1]==="n"){ out+="\n"; i+=2; continue; }
        out+=ch; i++;
      }
      return out;
    }
    function doScanf(fmt, targets, sc){
      var i=0, ti=0;
      while(i<fmt.length){
        var ch=fmt[i];
        if(ch==="%"&&i+1<fmt.length){
          var sp=fmt[i+1];
          if(sp==="%"){ i+=2; continue; }
          var tk=stdinToks.shift();
          if(tk===undefined) tk="0";
          var target=targets[ti]; ti++;
          if(!target) { i+=2; continue; }
          var lv=getLValue(target, sc);
          var nv=0;
          if(sp==="d") nv=parseInt(tk,10)||0;
          else if(sp==="f") nv=parseFloat(tk)||0;
          else if(sp==="c") nv=(String(tk))[0]||"";
          else if(sp==="s") nv=String(tk);
          if(sp==="c") lv.set(nv); else lv.set(nv);
          i+=2; continue;
        }
        i++;
      }
    }

    function exec(node, sc, retObj, globalSrc){
      sentinel++;
      if(sentinel>MAX_STMTS){ infinity=true; throw {msg:"حد التنفيذ الأقصى — تحقق من وجود حلقة لا نهائية"}; }
      var frameIdx=-1;
      if(traceMode){
        timeline.push({line:node.line||1, vars:varsSnapshot(), outStart:outBuffer.length, out:null});
        frameIdx=timeline.length-1;
      }
      try{
        switch(node.kind){
          case "block": {
            var local=new Scope(sc);
            scopeStack.push(local);
            try { node.stmts.forEach(function(s){ exec(s, local, retObj); }); }
            finally { scopeStack.pop(); }
            break;
          }
          case "decl": {
            node.vars.forEach(function(v){
              var typ=v.type;
              if(v.isArr){
                var size=Math.max(0, Math.trunc(evalExpr(v.size, sc).val));
                var arr=new Array(size);
                for(var k=0;k<size;k++) arr[k]=0;
                if(v.init){ v.init.forEach(function(ie,k2){ if(k2<size) arr[k2]=coerce(evalExpr(ie,sc).val,typ); }); }
                sc.declare(v.name, {type:typ, val:0, isArr:true, arr:arr});
              } else {
                var val= v.init ? coerce(evalExpr(v.init, sc).val, typ) : coerce(0, typ);
                sc.declare(v.name, {type:typ, val:val, isArr:false});
              }
            });
            break;
          }
          case "expr": evalExpr(node.e, sc); break;
          case "if": if(truthy(evalExpr(node.c,sc))) exec(node.t,sc,retObj); else if(node.f) exec(node.f,sc,retObj); break;
          case "while": while(truthy(evalExpr(node.c,sc))){ try{ exec(node.body,sc,retObj); }catch(x){ if(x&&x.__bc) { if(x.__bc==="continue") { continue; } if(x.__bc==="break") { break; } } throw x; } } break;
          case "doWhile": do{ try{ exec(node.body,sc,retObj); }catch(x){ if(x&&x.__bc){ if(x.__bc==="continue"){} if(x.__bc==="break"){ break; } } } if(!truthy(evalExpr(node.c,sc))) break; }while(true); break;
          case "for": {
            var fs=new Scope(sc);
            scopeStack.push(fs);
            try {
              if(node.init){ if(node.init.kind==="decl") { node.init.vars.forEach(function(v){ var typ=v.type; if(v.isArr){ var size=Math.max(0,Math.trunc(evalExpr(v.size,fs).val)); var arr=new Array(size); for(var k=0;k<size;k++) arr[k]=0; if(v.init){v.init.forEach(function(ie,k2){ if(k2<size) arr[k2]=coerce(evalExpr(ie,fs).val,typ); });} fs.declare(v.name,{type:typ,val:0,isArr:true,arr:arr}); } else { var val=v.init?coerce(evalExpr(v.init,fs).val,typ):0; fs.declare(v.name,{type:typ,val:val,isArr:false}); } }); } else evalExpr(node.init.e, fs); }
              for(;;){
                if(node.cond && !truthy(evalExpr(node.cond,fs))) break;
                try{ exec(node.body, fs, retObj); }catch(x){ if(x&&x.__bc){ if(x.__bc==="break") break; if(x.__bc==="continue"){} } else throw x; }
                if(node.step) evalExpr(node.step, fs);
              }
            } finally { scopeStack.pop(); }
            break;
          }
          case "break": throw {__bc:"break"}; 
          case "continue": throw {__bc:"continue"};
          case "return": { var rv={type:"int", val:0}; if(node.e) rv=evalExpr(node.e, sc); throw {__ret:true, type:rv.type, val:rv.val}; }
          case "printf": outBuffer += doPrintf(node.fmt, node.args.map(function(a){return evalExpr(a,sc);})); break;
          case "scanf": doScanf(node.fmt, node.targets, sc); break;
          default: throw {msg:"جملة غير معروفة"};
        }
      } finally {
        if(traceMode && frameIdx>=0 && timeline[frameIdx]){
          timeline[frameIdx].out = outBuffer.slice(timeline[frameIdx].outStart);
        }
      }
      return true;
    }

    try {
      exec(mainFn.body || {kind:"block",stmts:[]}, globalScope, null, null);
    } catch(e2){
      if(e2 && e2.__ret){ /* تجاهل */ }
      else return {ok:false, error:(e2&&e2.msg)||"خطأ تنفيذ", output:outBuffer, timeline:timeline};
    }
    return {ok:true, output:outBuffer, timeline:timeline};
  }

  return { run: run, tokenize: tokenize };
})();

/* ============================== UI ENGINE ============================== */

"use strict";

var DS = window.DATA_STORE;
var META = DS.META || {};
var GLOSSARY = DS.glossary || {};
var CONTENT = DS.CONTENT || { units: [] };

/* ---------- tiny helpers ---------- */
function esc(s){ return String(s==null?"":s).replace(/[&<>"']/g, m => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m])); }
function nl(s){ return esc(s).replace(/\n/g,'<br>'); }
function prefersReduced(){ return matchMedia('(prefers-reduced-motion: reduce)').matches; }
function smoothScroll(){ return prefersReduced() ? 'auto' : 'smooth'; }
let UID = 0;
function uid(p){ return (p || 'x') + (++UID); }
function shuffle(a){ a = a.slice(); for(let i=a.length-1;i>0;i--){ const j = Math.floor(Math.random()*(i+1)); const t=a[i]; a[i]=a[j]; a[j]=t; } return a; }
function normCode(c){ if(!c) return ''; return String(c).replace(/؛/g,';').replace(/,\.\.\.,/g,','); }
function stripParenthesized(s, markers){ return String(s||''); }

/* ---------- data navigation ---------- */
function unitById(uId){
  var arr = CONTENT.units || [];
  for(var _i=0;_i<arr.length;_i++){ if(arr[_i].id === uId) return arr[_i]; }
  return null;
}
function secLabel(s){ return s.label || s.title || ''; }
function unitTitle(uId){ var u = unitById(uId); return u ? u.title : ''; }
function unitIcon(uId){ var m = META.units[uId]; return (m && m.icon) || '📘'; }
function unitQ(uId){ var m = META.units[uId]; return (m && m.question) || (unitById(uId)||{}).description || ''; }
function unitSkills(uId){ var m = META.units[uId]; return (m && m.skills) || []; }
function unitGoals(uId){ var m = META.units[uId]; return (m && m.goals) || []; }
function conIcon(c){ return (c && c.icon) || unitIcon(c && c._unit); }
function exOptions(ex){ return ex.options || []; }
function exAns(ex){ return (ex.correct !== undefined) ? ex.correct : (ex.answer !== undefined ? ex.answer : -1); }
function orderExpected(ex){ return (ex.correct || []).map(function(i){ return ex.items[i]; }); }
function unitSections(uId){ var u = unitById(uId); return u ? (u.sections || []) : []; }
function unitConcepts(uId){
  const out = [];
  (unitSections(uId)||[]).forEach(s => {
    (s.concepts||[]).forEach(c => out.push({ sec: s, con: c }));
  });
  return out;
}
function conceptAt(uId, pos){ const f = unitConcepts(uId); return f[Math.max(0, Math.min(pos, f.length-1))]; }
function sectionIndex(u, sec){ const ss = unitSections(u); return ss.findIndex(s => s.id === sec.id); }
function flatPos(u, secId, conId){
  const f = unitConcepts(u);
  for(let i=0;i<f.length;i++){ if(f[i].sec.id === secId && f[i].con.id === conId) return i; }
  return 0;
}
function unitSolvedCount(uId){
  const pr = Progress.unit(uId);
  let n = 0;
  Object.keys(pr.solved||{}).forEach(k => { if(pr.solved[k]) n++; });
  return n;
}
function totalConcepts(){ let n = 0; Object.keys(META.units).forEach(u => n += unitConcepts(u).length); return n; }
function totalDone(){
  const P = Progress.get();
  let n = 0;
  Object.keys(META.units).forEach(u => {
    const un = P.units && P.units[u];
    if(un) Object.keys(un.done||{}).forEach(k => { if(un.done[k]) n++; });
  });
  return n;
}

/* ---------- search index ---------- */
let SEARCH_IDX = null;
function searchIndex(){
  if(SEARCH_IDX) return SEARCH_IDX;
  const out = [];
  let gi = 0;
  Object.keys(META.units).forEach(uId => {
    const meta = META.units[uId];
    out.push({ type:'unit', uId, gi:gi++, loc:'الوحدة '+uId, title: meta.title, text: meta.question });
    (unitSections(uId)||[]).forEach(s => {
      out.push({ type:'section', uId, secId:s.id, gi:gi++, loc:'الوحدة '+uId+' · '+secLabel(s), title:s.title, text:s.summary });
      (s.concepts||[]).forEach(c => {
        out.push({ type:'concept', uId, secId:s.id, conId:c.id, gi:gi++, loc:'الوحدة '+uId+' · '+secLabel(s), title:c.title, text:c.explanation });
      });
    });
  });
  const seen = {};
  Object.keys(GLOSSARY).forEach(term => {
    const t = String(term).trim(); if(!t || seen[t]) return; seen[t] = 1;
    out.push({ type:'term', term:t, gi:gi++, loc:'دليل المصطلحات', title:t, text:GLOSSARY[t] });
  });
  SEARCH_IDX = out;
  return SEARCH_IDX;
}

/* ============================== PROGRESS ============================== */
const Progress = {
  KEY: 'dp-courselab-progress-v1',
  data: null,
  load(){ if(this.data) return this.data; try{ this.data = JSON.parse(localStorage.getItem(this.KEY)) || {}; }catch(e){ this.data = {}; } return this.data; },
  save(){ try{ localStorage.setItem(this.KEY, JSON.stringify(this.data)); }catch(e){} },
  get(){ return this.load(); },
  unit(u){
    const d = this.get();
    d.units = d.units || {};
    d.units[u] = d.units[u] || { done:{}, solved:{}, marks:{}, last:0 };
    return d.units[u];
  },
  isDone(u, cid){ return !!(this.unit(u).done || {})[cid]; },
  solved(u, cid, e){ return !!(this.unit(u).solved || {})[cid+':'+e]; },
  markSolved(u, cid, e){
    const un = this.unit(u);
    const k = cid + ':' + e;
    if(!un.solved[k]){ un.solved[k] = true; this.save(); this.onChange && this.onChange(); }
  },
  markDone(u, cid){
    const un = this.unit(u);
    if(!un.done[cid]){ un.done[cid] = true; this.save(); this.onChange && this.onChange(); }
  },
  touched(){ this.save(); this.onChange && this.onChange(); },
  onChange: null
};

/* ============================== ROUTER ============================== */
const App = {
  state: { name:'home' },
  go(name, extra){
    Object.assign(this.state, { name:name }, extra || {});
    window.scrollTo({ top:0, behavior: smoothScroll() });
    render();
  },
  render(){ render(); }
};

function render(){
  const root = document.getElementById('app');
  if(!root) return;
  const s = App.state;
  document.body.classList.toggle('lenient', !!Progress.get().freebrowse);
  let html = '', head = '', tail = '';
  if(s.name === 'home'){ html = homeHTML(); }
  else if(s.name === 'units'){ html = unitsHTML(); }
  else if(s.name === 'unit'){ html = unitHTML(s.unitId); }
  else if(s.name === 'learn'){ html = learnHTML(s.unitId, s.pos); }
  else if(s.name === 'unitend'){ html = unitEndHTML(s.unitId); }
  else if(s.name === 'ref'){ html = refHTML(s.unitId, s.secId, s.conId); }
  else if(s.name === 'search'){ html = searchHTML((s.q||'')); }
  else if(s.name === 'glossary'){ html = glossaryHTML(); }
  else if(s.name === 'dashboard'){ html = dashboardHTML(); }
  root.innerHTML = '<div class="page-anim">' + html + '</div>';
  const hub = root.firstElementChild;
  attachDynamic(hub);
}

function attachDynamic(hub){
  const s = App.state;
  if(s.name === 'learn') initLearn(hub);
  else if(s.name === 'unitend') initUnitEnd(hub);
  else if(s.name === 'search') initSearchPage(hub);
  else if(s.name === 'unit') initUnitPage(hub);
  else if(s.name === 'ref') initRefPage(hub);
}

/* ============================== HOME ============================== */
function homeHTML(){
  const P = Progress.get();
  const last = P.lastPos;
  const done = totalDone(), tc = totalConcepts(), pct = tc ? Math.round(done/tc*100) : 0;
  const units = Object.keys(META.units).map(uId => {
    const m = META.units[uId];
    const un = (P.units && P.units[uId]) || {};
    const d = Object.keys(un.done||{}).length, t = unitConcepts(uId).length;
    return { uId, m, d, t, pct: t? Math.round(d/t*100):0 };
  });
  const resume = last && META.units[last.u] ? `
    <button class="ghost-btn" data-act="learn" data-unit="${esc(last.u)}" data-pos="${last.p||0}">
      استكمال تقدمك: الوحدة ${esc(last.u)} — ${esc(META.units[last.u].title)}
    </button>` : '';
  return `
  <section class="page">
    <div class="hero reveal in" style="padding-top:44px">
      <h1 style="margin-top:0">مختبر معالجة البيانات</h1>
      <p>ورشة تفاعلية تفركّب المفاهيم فوق بعضها: تمثيلات بصرية متحركة، سيناريوهات «ماذا لو»، مشارط كود تفنفَّذ خطوة بخطوة، واختبارات ذات ربط مباشر بالمقرر لتجعل التعلم خبرةً تفعملها، لا نصاً تفمرّره.</p>
      <div class="h-actions">
        <button class="btn btn-inv" data-act="learn" data-unit="01" data-pos="0">ابدأ التعلم الآن</button>
        <button class="ghost-btn" data-act="dashboard">لوحة تقدّمك</button>
        ${resume}
      </div>
    </div>

    <h3 class="section-title">رحلتك</h3>
    <p class="section-sub">٦ وحدات تغطي مسار المقرر من البيانات حتى توظيف الحاسوب</p>
    <div class="journey">
      ${units.map(x => `
        <div class="jnode ${x.pct>=100?'done':''} reveal" data-act="learn" data-unit="${esc(x.uId)}" data-pos="0">
          <div class="j-ic">${x.m.icon}</div>
          <div class="j-t">الوحدة ${x.uId}</div>
          <div class="j-s">${esc(x.m.title)} · ${x.pct}%</div>
        </div>`).join('')}
    </div>

    <h3 class="section-title">كيف تعمل ورشة المفاهيم؟</h3>
    <p class="section-sub">كل مفهوم يتحول إلى مسرح تفاعلي خاص به</p>
    <div class="examples-grid" style="grid-template-columns:repeat(auto-fill,minmax(250px,1fr))">
      ${[
        ['1️⃣','سؤال يفتح العقل','يبدأ كل مفهوم بمشهد سؤال يحفز التفكير قبل أي إجابة رسمية.'],
        ['2️⃣','شرح مساعد + تشبيه','قبل الصياغة الأكاديمية: شرح بمفرداتك، ثم تشبيه من الحياة يشبّع المعنى.'],
        ['3️⃣','تمثيل بصري متحرك','المفهوم يتحول إلى صور متدرجة تنبّض بالحياة مع التحكم بخطواتها.'],
        ['4️⃣','مشارط كود حية','في لغة C: برامج تفشغَّل فعلياً وتفتتبع سطراً سطراً ويمكن لعبك بها.'],
        ['5️⃣','تمارين بسلّم تلميحات','الخطأ ليس عقبة بل وقود: تلميح بعد تلميح حتى تحل المسألة بنفسك.'],
        ['6️⃣','خاتمة إتقان واحد لواحد','استذكار سريع، أخطاء شائعة، وتلميح امتحاني لكل مفهوم.'],
      ].map(x => `<div class="example-card reveal"><div class="e-top"><div class="e-icon">${x[0]}</div><div class="e-title">${x[1]}</div></div><p class="en">${x[2]}</p></div>`).join('')}
    </div>

    <h3 class="section-title">ماذا ستفتقن في النهاية؟</h3>
    <p class="section-sub">مذكّرة <strong>Learning Support</strong> تفخاطب عقلك بصيغة: «أنت الآن قادر على…»</p>
    <div class="stat-row">
      <div class="stat-card"><div class="st-n">${pct}<span style="font-size:16px">%</span></div><div class="st-l">${done} من ${tc} مفهوماً مكتملاً</div></div>
      <div class="stat-card"><div class="st-n">${units.filter(x=>x.pct>=100).length}/6</div><div class="st-l">وحدات منجزّة</div></div>
      <div class="stat-card"><div class="st-n">${Object.keys(GLOSSARY).length}</div><div class="st-l">مصطلحاً في الدليل</div></div>
      <div class="stat-card"><div class="st-n">${Object.keys(META.units).reduce((a,u)=>a+(META.units[u].skills||[]).length,0)}</div><div class="st-l">مهارة مكتسبة</div></div>
    </div>
  </section>`;
}

/* ============================== UNITS / UNIT ============================== */
function unitsHTML(){
  return `
  <section class="page">
    <h1 class="page-title" style="font-size:26px;font-weight:900;margin:4px 0 6px">وحدات المقرر</h1>
    <p class="section-sub" style="margin-bottom:22px">اختر وحدة — كل وحدة تفحفظ استقلالياً، وتفبنى مفاهيمها تدريجياً نحو هدف واحد.</p>
    <div class="units-grid">
      ${Object.keys(META.units).map(uId => {
        const m = META.units[uId];
        const un = (Progress.get().units||{})[uId] || {};
        const t = unitConcepts(uId).length;
        const d = Object.keys(un.done||{}).length;
        const pct = t ? Math.round(d/t*100) : 0;
        const q = unitSections(uId).length;
        return `
        <div class="unit-card reveal" data-act="unit" data-unit="${esc(uId)}">
          <div class="u-ic">${m.icon}</div>
          <div style="flex:1;min-width:0">
            <div class="u-t">الوحدة ${uId} · ${esc(m.title)}</div>
            <div class="u-q">${esc(m.question)}</div>
            <div style="display:flex;gap:8px;align-items:center;margin-top:10px">
              <div class="pb-track" style="flex:1"><div class="pb-fill" style="width:${pct}%"></div></div>
              <span class="pill ${pct? (pct>=100?'good':'') : 'empty'}">${pct}% · ${d}/${t} مفهوم</span>
            </div>
          </div>
        </div>`;
      }).join('')}
    </div>
  </section>`;
}

function unitHTML(uId){
  const meta = META.units[uId];
  const un = Progress.unit(uId);
  const t = unitConcepts(uId).length;
  const d = Object.keys(un.done||{}).length;
  const pct = t ? Math.round(d/t*100) : 0;
  const sections = unitSections(uId);
  let conIdx = 0;
  return `
  <section class="page page-narrow">
    <div class="hero reveal in" style="padding:32px 28px">
      <div style="display:flex;gap:16px;align-items:center;flex-wrap:wrap">
        <div style="width:64px;height:64px;border-radius:18px;background:rgba(255,255,255,.14);display:flex;align-items:center;justify-content:center;font-size:30px">${meta.icon}</div>
        <div style="flex:1;min-width:240px">
          <h1 style="margin:0;font-size:23px">الوحدة ${uId} · ${esc(meta.title)}</h1>
          <p style="margin:6px 0 0;color:#d4d4d8">${esc(meta.question)}</p>
        </div>
      </div>
      <div style="display:flex;gap:10px;flex-wrap:wrap;margin-top:18px">
        <button class="btn btn-inv" data-act="learn" data-unit="${esc(uId)}" data-pos="${conIdx}">ابدأ التعلم</button>
        <button class="ghost-btn" data-act="ref" data-unit="${esc(uId)}">المرجع الأكاديمي</button>
      </div>
    </div>

    <div class="stat-row">
      <div class="stat-card"><div class="st-n">${d}/${t}</div><div class="st-l">مفاهيم مكتملة</div></div>
      <div class="stat-card"><div class="st-n">${pct}%</div><div class="st-l">نسبة التقدم</div></div>
      <div class="stat-card"><div class="st-n">${sections.length}</div><div class="st-l">أقسام</div></div>
      <div class="stat-card"><div class="st-n"></div><div class="st-l"><div class="pb-track" style="margin-top:8px"><div class="pb-fill" style="width:${pct}%"></div></div></div></div>
    </div>

    <h3 class="section-title">أهداف الوحدة</h3>
    <ul class="goals-list">
      ${(meta.goals||[]).map(g => `<li><span style="color:var(--acc)">◆</span><span>${esc(g)}</span></li>`).join('')}
    </ul>

    <h3 class="section-title">دليل التقدم (مع خريطة المفهوم)</h3>
    <p class="section-sub">كل بطاقة تففتح عندما تكتمل سابقتها — إلا إذا فعّلت «التجوال الحر» من اللوحة.</p>
    ${sections.map(s => {
      const sIdx = sectionIndex(uId, s);
      return `
      <div class="preset-group">
        <h4><span class="pg-ic">📚</span> ${esc(s.label)} · ${esc(s.title)}</h4>
        <div class="dash-rows" style="margin-top:0">
          ${s.concepts.map(c => {
            const pos = conIdx++;
            const doneC = un.done[c.id];
            const locked = !Progress.get().freebrowse && pos>0 && !un.done[conceptAt(uId, pos-1).con.id];
            return `
            <div class="dash-row reveal ${doneC?'':''}" data-act="learn" data-unit="${esc(uId)}" data-pos="${pos}" data-locked="${locked?'1':''}">
              <div class="dr-ic">${doneC ? '✅' : '🎯'}</div>
              <div style="min-width:0">
                <div class="dr-t">${doneC ? '' : ''}${esc(c.title)}</div>
                <div class="dr-s">${esc(c.explanation)}</div>
              </div>
              <div class="${doneC?'pill good':'pill'}">${doneC?'مكتمل':(locked?'مقفل':'ابدأ →')}</div>
            </div>`;
          }).join('')}
        </div>
      </div>`;
    }).join('')}

    <div style="margin-top:26px;display:flex;gap:10px;flex-wrap:wrap">
      <button class="ghost-btn" data-act="unitend" data-unit="${esc(uId)}">🏁 اختبار نهاية الوحدة</button>
    </div>
  </section>`;
}

function initUnitPage(hub){ initLearn(hub); }

/* ============================== LEARN ============================== */
function learnHTML(uId, pos){
  const f = unitConcepts(uId);
  if(!f.length) return '<div class="page"><p>لا يوجد محتوى.</p></div>';
  pos = Math.max(0, Math.min(pos, f.length-1));
  const cur = f[pos];
  const tag = cur.con.id.slice(0,2); // icon key
  const pct = Math.round(totalDone()/totalConcepts()*100);
  const dots = f.map((x,i) => {
    const locked = !Progress.get().freebrowse && i>0 && !Progress.isDone(uId, f[i-1].con.id);
    const d = Progress.isDone(uId, x.con.id);
    return `<button class="dot ${i===pos?'cur':''} ${d?'done':''} ${locked?'locked':''}" title="${esc(x.con.title)}" ${locked?'disabled':''} data-act="learn" data-unit="${esc(uId)}" data-pos="${i}">${i+1}</button>`;
  }).join('');
  const meta = META.units[uId];
  const scenes = buildScenes(uId, cur, pos, f.length);
  const prevBtn = pos>0 ? `<button class="btn btn-ghost" data-act="learn" data-unit="${esc(uId)}" data-pos="${pos-1}">→ السابق</button>` : '';
  const nextBtn = pos<f.length-1
    ? `<button class="btn" data-act="learn" data-unit="${esc(uId)}" data-pos="${pos+1}">التالي ←</button>`
    : `<button class="btn" data-act="unitend" data-unit="${esc(uId)}">🏁 اختبار نهاية الوحدة ←</button>`;
  return `
  <div class="learn-page" data-learn>
    <div class="concept-bar">
      <div class="crd">الوحدة <b>${uId}</b> · ${esc(meta.title)}</div>
      <div class="dots">${dots}</div>
      <div class="mode-tabs">
        <button class="active" data-tab-mode="learn">أتعلم</button>
        <button data-act="ref" data-unit="${esc(uId)}" data-sec="${esc(cur.sec.id)}" data-con="${esc(cur.con.id)}">المرجع الأكاديمي</button>
      </div>
    </div>
    <div style="display:flex;align-items:center;gap:10px;margin-bottom:22px;flex-wrap:wrap">
      <div style="font-size:12.5px;color:var(--mut)">تقدّمك الكلي</div>
      <div class="pb-track" style="flex:1;min-width:120px"><div class="pb-fill" style="width:${pct}%"></div></div>
      <span class="pill">${pct}%</span>
    </div>
    ${scenes.map((s,i2) => `<div class="scene ${s.cls||''}" data-scene="${i2}">${s.html}</div>`).join('')}
    <div class="nextroll">
      ${prevBtn}
      <button class="btn btn-ghost" data-act="learn" data-unit="${esc(uId)}" data-pos="${pos}" style="min-width:150px">إعادة المشهد</button>
      ${nextBtn}
    </div>
  </div>`;
}

/* ---------- scene builders ---------- */
function buildScenes(uId, cur, pos, len){
  const c = cur.con;
  const sec = cur.sec;
  const meta = META.units[uId];
  const scenes = [];
  const tag = (n, t) => `<div class="scene-tag">المشهد ${n} · ${t}</div>`;

  /* 1 · question */
  scenes.push({
    cls:'scene-q',
    html: `${tag(1,'السؤال')}
      <p class="q-big">${esc(c.why || 'ما هذا المفهوم ولماذا نحتاجه؟')}</p>
      <p class="q-goal">في هذه الوحدة نستكشف: «${esc(meta.question)}». الهدف الآن: أن تمتلك تعريفاً قابلاً للاستعمال لمفهوم <strong>«${esc(c.title)}»</strong> وتحدّد دوره في مسار المعالجة.</p>`
  });

  /* 2 · supporting explanation */
  scenes.push({
    cls:'scene-idea',
    html: `${tag(2,'الشرح المساعد')}
      <div class="idea-card">
        <div style="display:flex;gap:10px;align-items:center;margin-bottom:8px">
          <span class="tag-ls">LEARNING SUPPORT</span>
          <b style="font-size:16px">افهم «${esc(c.title)}» بلغتك أولاً</b>
        </div>
        <p>${esc(c.explanation)}</p>
      </div>`
  });

  /* 3 · analogy */
  if(c.realWorld){
    scenes.push({
      cls:'scene-analogy',
      html: `${tag(3,'تشبيه من الواقع')}
        <div class="analogy-card reveal">
          <div class="a-icon">🪞</div>
          <div><div class="sim">لنتأمل المفهوم من خلال موقف حياتي</div>
          <p>${esc(c.realWorld)}</p></div>
        </div>`
    });
  }

  /* 4 · visual sticky scene (if any visual) */
  if(c.visual || c.memory){
    scenes.push({ cls:'scene-sticky', html: stickyHTML(c) , attach: el => initSticky(el, c) });
  }

  /* 5 · code watch + playground */
  if(c.code){
    scenes.push({ cls:'scene-code', html: watchHTML(c), attach: el => initWatch(el, c) });
  }
  if(c.land){
    scenes.push({ cls:'scene-playground', html: sandBoxHTML(c), attach: el => initSandbox(el, c) });
  }

  /* 6 · examples */
  if(c.examples && c.examples.length){
    scenes.push({
      cls:'scene-examples',
      html: `${tag(6,'أمثلة تعزّز التصور')}
        <div class="examples-grid">
          ${c.examples.map((e,i2) => {
            const isObj = e && typeof e === 'object';
            const title = isObj ? (e.title||'') : '';
            const text = isObj ? (e.en||e.text||'') : e;
            return `<div class="example-card reveal">
              <div class="e-top">
                <div class="e-icon">${conIcon(c)}</div>
                <div class="e-title">${esc(title||'مثال '+(i2+1))}</div>
              </div>
              <p class="en">${esc(text)}</p>
            </div>`;
          }).join('')}
        </div>`
    });
  }

  /* 7 · practice */
  if(c.exercises && c.exercises.length){
    scenes.push({
      cls:'scene-practice',
      html: `${tag(7,'تمرّن الآن')}
        <p class="section-sub" style="margin:0 0 4px">كل سؤال يحمل سلماً من تلميحات الدعم: خطأ؟ تلميح، ثم آخر، ثم الحل — والمهم الوصول إليها وحدك.</p>
        ${c.exercises.map((ex, i2) => exerciseHTML(c, ex, i2, uId)).join('')}`
    });
  }

  /* 8 · mastery */
  scenes.push({ cls:'scene-mastery', html: masteryHTML(c), attach: el => initMastery(el, uId, c) });

  return scenes;
}

/* ---------- sticky visual ---------- */
function stickyHTML(c){
  const terms = termsOf(c);
  let vis = '';
  const steps = c.visual ? (c.visual.steps||[]) : (c.memory && c.memory.computing ? c.memory.computing.map(x=>x.title) : []);
  const nodeCls = c.visual ? (c.visual.exec==='queuing' ? 'queue-node' : (c.visual.exec==='flow' ? 'flow-node' : 'mem-node')) : 'mem-node';
  const metaLbl = c.visual ? (c.visual.exec==='queuing' ? 'عنصر قائمة انتظار' : (c.visual.exec==='flow' ? 'عملية معالجة' : 'خلية ذاكرة')) : 'خلية ذاكرة';
  const isMemory = !!(c.memory);
  if(isMemory){
    const mem = c.memory;
    const boxes = mem.types || [];
    const head = mem.head || null;
    vis = `
      <div class="flow-stage" data-sync data-mem>
        <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;margin-bottom:12px">
          <b style="font-size:14.5px">خريطة ذاكرة المفهوم</b>
        </div>
        <div class="mem-area">
          ${boxes.map((b,bi) => {
            const hasHead = b === head;
            return `<div class="mem-box" data-mem-index="${bi}" style="${hasHead?'border-color:#fbbf24;background:#fffbeb':''}">
              ${hasHead?`<span class="mem-badge">head</span>`:''}
              <span class="mem-lbl">${esc(humanLabel(c.id))}</span>
              <span class="mem-val">${esc(b)}</span>
            </div>`;
          }).join('')}
        </div>
        ${mem.computing ? `
          <div class="mem-steps">
            ${mem.computing.map(st => `<span class="mem-step">${esc(st)}</span>`).join('<span style="color:#cbcbd4">←</span>')}
          </div>` : ''}
        <div class="flownav">
          <button class="btn btn-ghost small" data-mem-replay>🔄 إعادة تعيين</button>
        </div>
      </div>`;
  } else {
    vis = `
      <div class="flow-stage" data-sync data-flow>
        <div class="flow-list">
          ${steps.map((st,i2) => `
            <div class="fnode ${nodeCls}">
              <span class="nbadge">${i2+1}</span>
              <div style="min-width:0"><div class="nlabel">${esc(st)}</div><div class="nmeta">${esc(metaLbl)}</div></div>
            </div>${i2<steps.length-1?'<div class="farrow"></div>':''}`).join('')}
        </div>
        <div class="fstep-lbl"><b data-stepinfo>خطوة 1 من ${steps.length}</b></div>
        <div class="flownav">
          <button class="btn small" data-play>▶ تشغيل</button>
          <button class="btn btn-ghost small" data-pause>⏸ إيقاف</button>
          <button class="btn btn-ghost small" data-step>الخطوة ←</button>
          <button class="btn btn-ghost small" data-replay>🔄</button>
        </div>
      </div>`;
  }
  return `
    ${tag(4,'التمثيل البصري التفاعلي')}
    <div class="sticky-scene">
      <div class="vis-side reveal">${vis}</div>
      <div class="walk-side reveal">
        <span class="tag-ls">من المرجع الأكاديمي</span>
        <p style="font-weight:800;font-size:17px;margin:8px 0 6px">المفهوم بصياغته الدقيقة</p>
        <p class="kw-text" data-kw>${kwHtml(c.academic)}</p>
        <div class="kw-chips">${(terms||[]).slice(0,8).map((t,i2) => `<span class="kw-chip" style="transition-delay:${i2*80}ms">${esc(t)}</span>`).join('')}</div>
        <div style="margin-top:14px">
          <button class="ghost-btn small" data-act="ref" data-unit="${esc(curUnitIdFor(c))}" data-sec="${esc(curSecIdFor(c))}" data-con="${esc(c.id)}">📖 نص المرجع الكامل ←</button>
        </div>
      </div>
    </div>`;
}
function termsOf(c){
  const s = String(c.academic||'');
  const re = /\(([^()]+)\)/g; let m, out=[];
  while((m = re.exec(s))){ out.push(m[1]); }
  const extras = (c.terms||[]).filter(t => !out.some(o => o.indexOf(t)>=0));
  return out.concat(extras);
}
function curUnitIdFor(c){ return c._unit || ''; }
function curSecIdFor(c){ return c._sec || ''; }
function kwHtml(t){
  return esc(t).replace(/\(([^()]*)\)/g, (mm, inner) => `<span class="kwt"><span class="kleft">(</span>${inner}<span class="kright">)</span></span>`);
}
function humanLabel(id){ return mappingIdLabel[id] || id; }

/* ---------- watch (code runs + steps) ---------- */
function watchHTML(c){
  return `${tag(5,'شاهد الكود يتحرك')}
    <p class="section-sub" style="margin:0 0 12px">الكود الحقيقي للمفهوم — شغّله كاملاً أو تتبّعه سطراً بسطر مع مراقبة الذاكرة والمخرجات.</p>
    <div class="code-card reveal" data-watch>
      <div class="cc-top"><span class="mode-badge">مشاهدة</span><span style="font-size:12.5px;color:var(--mut)">${esc(c.title)}</span></div>
      <pre class="code-view"></pre>
      <div class="cc-actions">
        <div class="btns">
          <button class="btn small" data-run>▶ تنفيذ كامل</button>
          <button class="btn btn-ghost small" data-step>1 ← خطوة</button>
          <button class="btn btn-ghost small" data-rerun>🔄 إعادة</button>
          <span class="trace-pager"><span data-pager>جاهز</span></span>
        </div>
        <div class="trace-now"><b>⏳ السطر الحالي بعد الخطوة الأخيرة: <span data-tnac></span></b></div>
      </div>
      <div class="out-panel">
        <div><h5>🖥️ المخرجات</h5><div class="console-box" data-console></div></div>
        <div><h5>🗂️ محتوى الذاكرة</h5><table class="vars-table"><thead><tr><th>name</th><th>value</th><th>type</th></tr></thead><tbody data-rows></tbody></table></div>
      </div>
    </div>`;
}
function initWatch(el, c){
  const src0 = normCode(c.code);
  const pre = $n('.code-view', el);
  const lines = src0.split('\n');
  pre.innerHTML = lines.map((ln, i) => `<span class="ln" data-ln="${i}"><span class="c-num">${i+1}</span>${esc(ln)}</span>`).join('');
  const consoleEl = $n('[data-console]', el);
  const rowsEl = $n('[data-rows]', el);
  const pager = $n('[data-pager]', el);
  const tnac = $n('[data-tnac]', el);
  let entries = [], traceOn = false, cur = 0;
  const stdinArr = [];
  function highlight(i){ $na('.ln', pre).forEach(x => x.classList.toggle('hot', +x.dataset.ln === i)); }
  function renderVars(vars){
    if(!vars || !vars.length){ rowsEl.innerHTML = '<tr><td colspan="3" style="color:var(--mut)">— (لا متغيرات بعد)</td></tr>'; return; }
    rowsEl.innerHTML = vars.map(v => `<tr><td>${esc(v.name)}</td><td>${esc(v.value)}</td><td>${esc(v.type)}</td></tr>`).join('');
  }
  function render(entry, ci){
    if(ci <= 0){ consoleEl.textContent = ''; rowsEl.innerHTML = ''; highlight(-1); pager.textContent = 'جاهز'; tnac.textContent = ''; return; }
    if(entry){
      highlight(entry.line);
      tnac.textContent = ((lines[entry.line-1]||'').trim() || '—');
    }
    let txt = '';
    for(let k=0;k<ci;k++){ if(entries[k] && entries[k].out !== null) txt += entries[k].out; }
    consoleEl.textContent = txt || '…';
    renderVars(entry ? entry.vars : []);
    pager.textContent = 'الخطوة ' + ci + ' من ' + entries.length;
  }
  function build(){
    const r = runSource(src0, stdinArr, true);
    if(!r.ok){
      traceOn = false;
      consoleEl.innerHTML = '<span style="color:#fca5a5">⚠️ ' + esc(r.err) + '</span>';
      renderVars([]);
      pager.textContent = 'خطأ أثناء التحليل — راجع السطر المذكور، جرّب تعديلاً في المصحّة أدناه';
      tnac.textContent = '';
      return false;
    }
    entries = r.tl || [];
    traceOn = entries.length > 0;
    cur = 0;
    render(null, 0);
    return true;
  }
  build();
  $n('[data-run]', el).addEventListener('click', () => {
    if(!entries.length) build();
    cur = entries.length;
    render(entries[cur-1], cur);
  });
  $n('[data-step]', el).addEventListener('click', () => {
    if(!traceOn){ build(); }
    if(cur < entries.length){ cur++; render(entries[cur-1], cur); }
  });
  $n('[data-rerun]', el).addEventListener('click', () => {
    cur = 0; stdinArr.length = 0;
    build();
    render(null, 0);
  });
}

/* ---------- sandbox playground ---------- */
function sandBoxHTML(c){
  return `${tag('٥+', 'المصحّة التفاعلية')}
    <p class="section-sub" style="margin:0 0 12px">جوهر «ماذا لو»: عدّل الكود <em>هنا</em> والنتيجة تتغير أمامك فوراً — لا حاجة لمترجم خارجي.</p>
    <div class="code-card reveal" data-sandbox>
      <div class="cc-top"><span class="mode-badge" style="background:var(--ok)">مصحّة</span><span style="font-size:12.5px;color:var(--mut)">حرّر ثم نفّذ — لغة C (مبسطة)</span></div>
      <textarea class="editor" spellcheck="false"></textarea>
      <div class="cc-actions">
        <div class="btns">
          <button class="btn small" data-run>🏃 تشغيل</button>
          <button class="btn btn-ghost small" data-reset>↺ إعادة الأصل</button>
        </div>
        <div class="stdin-row"><label>المدخلات (scanf):</label><input data-stdin placeholder="مثال: 5"></div>
      </div>
      <div class="out-panel">
        <div><h5>🖥️ المخرجات</h5><div class="console-box" data-console></div></div>
        <div><h5>🗂️ محتوى الذاكرة</h5><table class="vars-table"><thead><tr><th>name</th><th>value</th><th>type</th></tr></thead><tbody data-rows></tbody></table></div>
      </div>
    </div>`;
}
function initSandbox(el, c){
  const ORIG = normCode(c.code);
  const ta = $n('.editor', el);
  ta.value = ORIG;
  const run = $n('[data-run]', el);
  const reset = $n('[data-reset]', el);
  const stdin = $n('[data-stdin]', el);
  const consoleEl = $n('[data-console]', el);
  const rowsEl = $n('[data-rows]', el);
  function exec(){
    const src = normCode(ta.value);
    const vals = stdin.value.trim() ? stdin.value.trim().split(/\s+/) : [];
    const r = runSource(src, vals, false);
    if(r.ok){
      consoleEl.textContent = r.out.join('');
      rowsEl.innerHTML = r.vars.length
        ? r.vars.map(v => `<tr><td>${esc(v.name)}</td><td>${esc(v.value)}</td><td>${esc(v.type)}</td></tr>`).join('')
        : '<tr><td colspan="3" style="color:var(--mut)">— (لا متغيرات بعد)</td></tr>';
    } else {
      consoleEl.innerHTML = '<span style="color:#fca5a5">⚠️ ' + esc(r.err) + '</span>';
      rowsEl.innerHTML = '';
    }
  }
  run.addEventListener('click', exec);
  reset.addEventListener('click', () => { ta.value = ORIG; stdin.value = ''; });
  ta.addEventListener('keydown', (e) => { if((e.ctrlKey || e.metaKey) && e.key === 'Enter'){ e.preventDefault(); exec(); } });
}

/* ---------- exercises ---------- */
function genId(c, ex, k){ return uid('x_' + c.id.replace(/\W/g,'') + '_' + k); }
function exerciseHTML(c, ex, i2, uId){
  const id = genId(c, ex, i2);
  const solved = Progress.solved(uId, c.id, i2);
  const typeIcon = ex.type === 'mcq' ? 'اختر الإجابة الصحيحة' : ex.type === 'open' ? 'أكمل بجملتك الخاصة' : ex.type === 'order' ? 'رتّب التسلسل الصحيح' : 'توقّع ثم تحقق';
  let body = '';
  if(ex.type === 'mcq' || ex.type === 'predict'){
    body = `
      <div class="opts">
        ${(ex.options||[]).map((o, oi) => `<div class="opt" data-opt="${oi}" data-predictable="${ex.type==='predict'?'1':'0'}"><span class="opt-bullet">${oi+1}</span><span>${esc(o)}</span></div>`).join('')}
      </div>
      <div class="ex-foot">
        <button class="btn small" data-check>تحقق من الإجابة</button>
        <button class="btn btn-ghost small" data-hint>💡 تلميح</button>
        <button class="btn btn-ghost small" data-sol style="display:none">🔓 الحل</button>
        <span class="pill empty" data-status style="margin-inline-start:auto">غير محلول</span>
      </div>`;
  }
  if(ex.type === 'open'){
    body = `
      <div class="open-wrap">
        <textarea placeholder="اكتب إجابتك بجملتك الخاصة هنا…" data-ans></textarea>
      </div>
      <div class="ex-foot">
        <button class="btn small" data-check>تحقق ذاتي (بالمعيار أدناه)</button>
        <button class="btn btn-ghost small" data-hint>💡 تلميح</button>
        <button class="btn btn-ghost small" data-sol style="display:none">🔓 الحل</button>
        <span class="pill empty" data-status style="margin-inline-start:auto">غير محلول</span>
      </div>`;
  }
  if(ex.type === 'order'){
    const items = shuffle((ex.order||[]).slice());
    body = `
      <div class="order-area" data-orderarea>
        ${items.map((it, oi) => `<div class="oitem" data-order-item="${oi}" draggable="true"><span class="oindex">${oi+1}</span><span class="ohandle">⠿</span><span>${esc(it)}</span></div>`).join('')}
      </div>
      <div class="ex-foot">
        <button class="btn small" data-check>تحقق من الترتيب</button>
        <button class="btn btn-ghost small" data-hint>💡 تلميح</button>
        <button class="btn btn-ghost small" data-sol style="display:none">🔓 الحل</button>
        <span class="pill empty" data-status style="margin-inline-start:auto">غير محلول</span>
      </div>`;
  }
  let q = ex.q || '';
  return `
  <div class="ex-card ${solved?'solved':''}" data-ex="${i2}" data-solved="${solved?'1':'0'}">
    <div class="ex-head">
      <span class="ex-type">${typeIcon}</span>
      <span class="ex-note">${esc(ex.note||'')}</span>
    </div>
    <div class="ex-q">${esc(q)}</div>
    ${body}
    <div class="ex-feedback" data-fb></div>
    <div class="hint-stack">
      <div class="hint-box show" data-h1>💡 تلميح ١ (عام): أعد صياغة السؤال بكلماتك: ما الذي يفطلب تحديداً؟ اربطه بالمفهوم الذي وصلت إليه في الألوانْ أعلاه.</div>
      <div class="hint-box" data-h2>💡 تلميح ٢ (خاص بالمسألة): ${esc(ex.hint||'راجع صياغة «المرجع الأكاديمي» وموضع المفهوم في على المسار.')}</div>
      <div class="hint-box" data-h3>💡 تلميح ٣ (طريقة الوصول): استبعد الخيارات غير المتفقة مع التعريف الرسمي، أو أعد ترتيب الأحداث وفق «المصطلح ← السياق ← الدليل».</div>
      <div class="hint-box truth-box" data-sol2></div>
    </div>
  </div>`;
}
function initExerciseCard(card, c, ex, i2, uId){
  const solved = Progress.solved(uId, c.id, i2);
  const $ = (s) => card.querySelector(s);
  const optEls = $a(card, '.opt');
  const fb = $('[data-fb]');
  const status = $('[data-status]');
  let sel = -1;
  let hintOpen = 0;
  function mark(ok){
    card.classList.add('solved');
    card.dataset.solved = '1';
    status.textContent = 'محلول ✓';
    status.className = 'pill good';
    Progress.markSolved(uId, c.id, i2);
  }
  function showHint(n){
    n = Math.min(3, Math.max(1, n));
    for(let i=1;i<=hintOpen+1 && i<=n;i++){ const h = $('[data-h'+i+']'); if(h){ h.classList.add('show'); } }
    hintOpen = Math.max(hintOpen, n);
    const sol = $('[data-sol]');
    if(sol && hintOpen >= 1){ sol.style.display = ''; }
    if(hintOpen >= 2){ const s2 = $('[data-sol2]'); if(s2) s2.classList.add('show'); }
  }
  function setFb(cls, html){
    fb.className = 'ex-feedback ' + (cls||'');
    fb.innerHTML = html;
  }
  const HIGHS = ['أحسنت!','ممتاز!','تمام!','إتقان!','رائع!'];
  function fbOk(txt){
    mark(true);
    setFb('ok', '✅ ' + HIGHS[Math.floor(Math.random()*HIGHS.length)] + ' ' + (txt||'إجابة صحيحة.'));
  }
  function fbBad(txt){
    setFb('bad', '❌ ' + (txt||'الإجابة غير صحيحة — لا بأس، جرّب التلميح ثم أعد المحاولة.'));
  }

  if(ex.type === 'mcq' || ex.type === 'predict'){
    const check = $('[data-check]');
    const hint = $('[data-hint]');
    const sol = $('[data-sol]');
    optEls.forEach((o, oi) => o.addEventListener('click', () => {
      if(card.dataset.solved === '1') return;
      sel = oi;
      optEls.forEach(x => x.classList.toggle('sel', x === o));
      setFb('');
    }));
    check.addEventListener('click', () => {
      if(card.dataset.solved === '1'){ setFb('ok','تم حل المسألة مسبقاً ✓'); return; }
      if(sel < 0){ setFb('bad','اختر إحدى الخيارات أولاً ثم اضغط تحقق.'); return; }
      const ok = ex.answer === sel;
      optEls.forEach((o, oi) => { o.classList.toggle('ok', oi === ex.answer); o.classList.toggle('bad', oi === sel && !ok); });
      if(ok){
        fbOk();
        hint.style.display = 'none';
      } else {
        fbBad('ليست صحيحة هذه المرة. الخطأ أشار إليك الآن أن تففكّر مزيداً — جرّب التلميح.');
        showHint(1);
      }
    });
    hint.addEventListener('click', () => showHint(hintOpen + 1));
    sol.addEventListener('click', () => {
      showHint(3);
      setFb('', true);
      if(ex.type === 'mcq'){
        setFb('', '');
        const buf = document.createElement('div');
        buf.className = 'ex-feedback show ok';
        buf.innerHTML = '🔓 الحل: «'+esc(ex.options[ex.answer])+'»<br><span style="color:#374151">السبب (المحتوى): <strong>'+esc(c.academic)+'</strong></span>';
        card.insertBefore(buf, fb.nextSibling);
        fb.style.display = 'none';
      }
    });
  }
  else if(ex.type === 'open'){
    const check = $('[data-check]');
    const hint = $('[data-hint]');
    const sol = $('[data-sol]');
    const ans = $('[data-ans]');
    let self = 0;
    check.addEventListener('click', () => {
      if(card.dataset.solved === '1'){ setFb('ok','حفظت إجابتك ✓'); return; }
      if(!ans.value.trim()){ setFb('bad','اكتب جملة واحدة على الأقل.'); return; }
      setFb('ok','راجفع ما كتبته: هل يعبّر فعلياً عن «'+esc(c.title)+'» بنصيحة الدعم أدناه؟ <button class="ghost-btn small" data-selfok style="margin:4px 6px 0 0">نعم، إجابتي تعبّر عنه ✓</button><button class="ghost-btn small" data-selfno>لا، أريد مراجعة المفاهيم أولاً</button>',);
      const b1 = card.querySelector('[data-selfok]');
      const b2 = card.querySelector('[data-selfno]');
      b1 && b1.addEventListener('click', () => { if(b2){ b2.remove(); } fbOk('إجابتك الخاصة وفثّقت — هذا هو مستوى الإتقان الحقيقي.'); });
      b2 && b2.addEventListener('click', () => { fbBad('جيّد صراحةً! راجع «الشرح المساعد» و«أمثلة» ثم أعد المحاولة.'); showHint(1); });
    });
    hint.addEventListener('click', () => showHint(hintOpen + 1));
    sol.addEventListener('click', () => { showHint(3); });
  }
  else if(ex.type === 'order'){
    const area = $('[data-orderarea]');
    let items = $a(area, '.oitem');
    let from = -1;
    function reindex(){
      $a(area, '.oitem').forEach((it, k) => { $('.oindex', it).textContent = k+1; });
    }
    function fence(){
      // swap two
    }
    items.forEach(it => {
      it.addEventListener('dragstart', (e) => { from = +it.dataset.orderItem; it.classList.add('grab'); e.dataTransfer && e.dataTransfer.setData('text/plain','x'); });
      it.addEventListener('dragend', () => it.classList.remove('grab'));
      it.addEventListener('dragover', (e) => e.preventDefault());
      it.addEventListener('drop', (e) => {
        e.preventDefault();
        const to = +it.dataset.orderItem;
        if(from < 0) return;
        const list = $a(area, '.oitem');
        const a = list.find(x => +x.dataset.orderItem === from);
        const b = list.find(x => +x.dataset.orderItem === to);
        // swap in DOM
        if(a !== b){
          const pa = a.parentNode; const pb = b.parentNode;
          const na = a.nextSibling, nb = b.nextSibling;
          pb.insertBefore(a, nb);
          pa.insertBefore(b, na);
          readd();
        }
        from = -1;
      });
      it.addEventListener('click', (e) => {
        if(e.target.closest('.ohandle')){ /* later */ }
      });
    });
    function readd(){ items = $a(area, '.oitem'); reindex(); }
    $('[data-check]').addEventListener('click', () => {
      if(card.dataset.solved === '1'){ setFb('ok','تم مسبقاً ✓'); return; }
      const current = $a(area, '.oitem').map(x => x.querySelector('span:last-child').textContent);
      const target = ex.order;
      const ok = current.every((v, k) => v === target[k]);
      $a(area, '.oitem').forEach((it, k) => {
        it.classList.remove('ok','bad');
        it.classList.add(ok ? 'ok' : (it.querySelector('span:last-child').textContent === target[k] ? 'ok' : 'bad'));
      });
      if(ok){ fbOk(); $('[data-hint]').style.display = 'none'; }
      else {
        fbBad('الترتيب غير مطابق — لاحظ أن التسلسل هنا يتبع «المصطلح ← السياق ← النتيجة».');
        showHint(1);
      }
    });
    $('[data-hint]').addEventListener('click', () => showHint(hintOpen + 1));
    $('[data-sol]').addEventListener('click', () => {
      showHint(3);
      const order = ex.order;
      const existing = $a(area, '.oitem').map(x => x.querySelector('span:last-child').textContent);
      let vals = order.map(t => {
        let it = null;
        $a(area,'.oitem').forEach(o => { if(!it && o.querySelector('span:last-child').textContent === t) it = o; });
        return it;
      });
      vals.forEach((it, k) => { if(it) area.appendChild(it); });
      readd();
      $a(area,'.oitem').forEach((x,k) => { x.classList.add('ok'); });
    });
    reindex();
  }
}
function $a(root, sel){ return Array.prototype.slice.call(root.querySelectorAll(sel)); }

/* ---------- mastery ---------- */
function masteryHTML(c){
  return `
    <div class="scene-mastery">
      <div class="scene-tag">المشهد 8 · الإتقان الذاتي</div>
      <div class="dash-rows">
        <div class="ex-card" style="margin-top:0">
          <div class="ex-head"><span class="ex-type">🧠 استذكار سريع</span></div>
          <div class="ex-q" style="font-size:14px;font-weight:600">لو تذكّرت جملة واحدة من «${esc(c.title)}» لكانت …</div>
          <div class="hint-box show" style="display:block">${esc(c.explanation)}</div>
        </div>
        <div class="ex-card" style="margin-top:0">
          <div class="ex-head"><span class="ex-type">⚠️ خطأ شائع أتجنّبه</span></div>
          <div class="hint-box show" style="display:block">${esc(exMiscon(c))}</div>
        </div>
        <div class="ex-card" style="margin-top:0">
          <div class="ex-head"><span class="ex-type">🎯 تلميح امتحاني</span></div>
          <div class="hint-box show" style="display:block">${esc(examTip(c))}</div>
        </div>
        <div class="ex-card" style="margin-top:0">
          <div class="ex-head"><span class="ex-type">🔍 نقل التطبيق</span></div>
          <p style="font-size:14px;color:var(--mut);margin:6px 0 10px">اكتب برنامجاً صغيراً أو مثالاً من حياتك يستعمل «${esc(c.title)}» — ثم اضغط «حفظ» كتذكار.</p>
          <textarea data-reflect style="width:100%;border:1.5px solid var(--line);border-radius:12px;padding:12px;font-size:14px;line-height:1.8;resize:vertical;min-height:70px"></textarea>
          <div class="ex-foot"><button class="btn small" data-save>📥 حفظ تذكاري</button><span class="pill empty" data-saved>محلياً</span></div>
        </div>
      </div>
      <div class="ex-foot" style="margin-top:22px">
        <button class="btn" data-finish>🏁 أفنهي هذا المفهوم</button>
        <span class="pill" data-finishst>بعد الإنهاء يمكنك الانتقال للمفهوم التالي</span>
      </div>
    </div>`;
}
function exMiscon(c){
  const arr = (Progress.get().misconTips) || {};
  const m = META.misconTips || {};
  return m[c.id] || 'لا تخلط بين تعبير المفهوم وتمثيله: اكتب التعريف بلغتك ثم طوّقه على مثال.';
}
function examTip(c){
  return 'في الامتحان: ابحث عن أسئلة «اختر، رتّب، أو أكمفل» حول «' + c.title + '». اقرأ المطلوب، عرّف المصطلح من سياقه، ثم اربطه بالتعريف الرسمي.';
}
function initMastery(el, uId, c){
  const save = el.querySelector('[data-save]');
  const fin = el.querySelector('[data-finish]');
  const saved = el.querySelector('[data-saved]');
  const ta = el.querySelector('[data-reflect]');
  const st = el.querySelector('[data-finishst]');
  const memo = Progress.unit(uId).marks || {};
  if(memo[c.id]){ if(ta){ ta.value = memo[c.id]; } saved.textContent = 'محفوظ ✓'; saved.className = 'pill good'; }
  if(Progress.isDone(uId, c.id)){ st.textContent = 'المفهوم مكتمل ✓ يمكنك الانتقال للاحق.'; }
  save.addEventListener('click', () => {
    Progress.unit(uId).marks[c.id] = ta.value;
    Progress.touched();
    saved.textContent = 'محفوظ ✓';
    saved.className = 'pill good';
  });
  fin.addEventListener('click', () => {
    Progress.markDone(uId, c.id);
    st.textContent = 'مكتمل ✓ — مفهوم أفنهي بنجاح.';
    st.className = 'pill good';
    fin.textContent = 'المفهوم مكتمل ✓';
  });
}

/* ---------- init sticky ---------- */
function initSticky(el, c){
  const stage = el.querySelector('[data-flow], [data-mem]');
  if(!stage) return;
  if(stage.dataset.sync === 'flow' || stage.dataset.flow != null){
    initFlow(stage, c);
  }
  if(stage.dataset.mem != null){ initMem(stage); }
}
function initFlow(stage, c){
  const nodes = $a(stage, '.fnode');
  const steps = (c.visual && c.visual.steps) || (c.memory && c.memory.computing) ? (c.visual? c.visual.steps : c.memory.computing.map(x=>x.title)) : [];
  const stepInfo = stage.querySelector('[data-stepinfo]');
  let cur = -1, timer = null;
  function set(i){
    cur = i;
    nodes.forEach((n, k) => { n.classList.toggle('active', k === i); n.classList.toggle('done', k < i); });
    if(stepInfo) stepInfo.textContent = i >= 0 ? ('خطوة ' + (i+1) + ' من ' + nodes.length + ' · ' + (steps[i] || '')) : ('خطوة 1 من ' + nodes.length);
  }
  function next(){ if(cur < nodes.length - 1) set(cur + 1); else clearTimer(); }
  function clearTimer(){ if(timer){ clearInterval(timer); timer = null; } }
  function play(){ clearTimer(); if(cur >= nodes.length - 1) set(-1); set(cur < 0 ? 0 : cur+1); timer = setInterval(next, 1500); }
  stage.querySelector('[data-play]').addEventListener('click', play);
  stage.querySelector('[data-pause]').addEventListener('click', () => { clearTimer(); });
  stage.querySelector('[data-step]').addEventListener('click', () => { clearTimer(); next(); });
  stage.querySelector('[data-replay]').addEventListener('click', () => { clearTimer(); set(-1); });
  set(-1);
  registerSync(stage, () => {
    const n = nodes.length && (stage.getBoundingClientRect().height > 0) ? 1 : 0;
  }, i => set(i));
}
function initMem(stage){
  const boxes = $a(stage, '.mem-box');
  const replay = stage.querySelector('[data-mem-replay]');
  let first = true;
  function pulse(){
    boxes.forEach((b, k) => { b.classList.remove('pulse'); void b.offsetWidth; b.classList.add('pulse'); });
  }
  function randAssign(){
    if(boxes.length < 2) { pulse(); return; }
    const a = Math.floor(Math.random()*boxes.length);
    const b = (a + 1 + Math.floor(Math.random()*(boxes.length-1))) % boxes.length;
    boxes[a].classList.add('pulse'); boxes[b].classList.add('pulse');
  }
  if(first && !prefersReduced()){ randAssign(); first = false; }
  replay.addEventListener('click', () => { randAssign(); });
  registerSync(stage, ()=>{}, (i) => {});
}

/* init scenes of learn view */
function initLearn(hub){
  const body = hub;
  observeReveals(body);
  const s = App.state;
  if(s.name === 'learn'){
    Progress.unit(s.unitId).last = s.pos;
    Progress.get().lastPos = { u: s.unitId, p: s.pos, mode:'learn' };
    Progress.save();
  }
  // attach scenes
  const cur = conceptAt(s.unitId || '06', s.pos || 0);
  const meta = META.units[cur._unit || s.unitId] || {};
  // we need the map of scene attaches; easier: store in data from builder.
  // Instead re-derive by walking .scene elements in order of buildScenes pattern
  const items = $a(body, '[data-scene]');
  const f = unitConcepts(s.unitId);
  const c = f[s.pos] ? f[s.pos].con : f[0].con;
  // exercises
  const scs = buildScenes(s.unitId, f[s.pos], s.pos, f.length);
  items.forEach((node, k) => {
    const def = scs[k];
    if(def && def.attach) def.attach(node);
    if(def && def.cls && def.cls.indexOf('scene-practice') >= 0){ initPracticeScene(node, c, s.unitId); }
  });
  observeReveals(body);
}
function initPracticeScene(node, c, uId){
  const cards = $a(node, '[data-ex]');
  cards.forEach((card, i2) => {
    const ex = c.exercises[i2];
    if(ex){ initExerciseCard(card, c, ex, i2, uId); }
  });
}

/* ---------- reveal observer ---------- */
let _io = null;
function observerIOS(){
  if(_io) return _io;
  _io = new IntersectionObserver((entries) => {
    entries.forEach(en => {
      if(!en.isIntersecting) return;
      const el = en.target;
      el.classList.add('in');
      if(el.dataset.kw){
        const chips = el.querySelectorAll('.kw-chip');
        chips.forEach((ch, k) => { ch.classList.add('on'); });
      }
      _io.unobserve(el);
    });
  }, { threshold: 0.12 });
  return _io;
}
function observeReveals(root){
  const el = root && root.querySelectorAll ? root : document;
  $a(root, '.reveal:not(.in), .kw-text[data-kw]').forEach(n => { if(!n.classList.contains('in')) observerIOS().observe(n); });
}

/* ---------- scroll-sync (sticky visual ↔ scroll) ---------- */
const SYNC = [];
let scrollTicking = false;
function registerSync(el, probe, apply){
  SYNC.push({ el, probe, apply });
  if(!scrollTicking){
    scrollTicking = true;
    document.addEventListener('scroll', () => {
      if(SYNC.length === 0) return;
      if(prefersReduced()) return;
      requestAnimationFrame(() => {
        const vpC = innerHeight * 0.45;
        SYNC.forEach(s => {
          if(!document.contains(s.el)) { s.el = null; return; }
          const r = s.el.getBoundingClientRect();
          if(r.bottom < 0 || r.top > innerHeight) return;
          const frac = Math.min(1, Math.max(0, (vpC - r.top) / Math.max(1, r.height)));
          const idx = Math.floor(frac * (s.el.querySelectorAll && s.el.querySelectorAll('.fnode').length || 1));
          s.apply && s.apply(idx);
        });
      });
    });
  }
}

/* ============================== SIM WRAPPER ============================== */
function runSource(src, stdinArr, wantTrace){
  try{
    const p = new CSim({ trace: !!wantTrace });
    return p.run(src, stdinArr || []);
  }catch(e){
    return { ok:false, err: String(e), out:[], vars:[], tl:[] };
  }
}

/* ============================== UNIT END ============================== */
function unitEndHTML(uId){
  const meta = META.units[uId];
  const f = unitConcepts(uId);
  const doneC = totalDone();
  const mc = (META.miscon || [])[uId] || [];
  const retrieval = shuffle(
    f.map(x => x.con).reduce((acc, c) => {
      (c.exercises||[]).forEach((ex, i2) => { if(ex.type === 'mcq'){ acc.push({ c, ex, i2 }); } });
      return acc;
    }, []).slice(0, 6)
  );
  return `
  <section class="page page-narrow">
    <div class="hero reveal in" style="padding:32px 28px;margin-bottom:22px">
      <div style="display:flex;gap:16px;align-items:center;flex-wrap:wrap">
        <div style="font-size:42px">${meta.icon}</div>
        <div style="flex:1;min-width:240px">
          <h1 style="margin:0;font-size:23px">ختام الوحدة ${uId}</h1>
          <p style="margin:6px 0 0;color:#d4d4d8">${esc(meta.question)}</p>
        </div>
      </div>
      <div style="display:flex;gap:10px;flex-wrap:wrap;margin-top:18px">
        <button class="btn btn-inv" data-act="learn" data-unit="${esc(uId)}" data-pos="0">إعادة استكشاف</button>
        <button class="ghost-btn" data-act="ref" data-unit="${esc(uId)}">المرجع الأكاديمي</button>
      </div>
    </div>

    <div class="unit-end">
      <div class="ue-title">🎉 أنجزت مفاهيم الوحدة</div>
      <div class="ue-sub">الآن: تحقق ذاتي عبر ٣ محطات — استرجاع، كشف أفكار خاطئة، ثم نقل تطبيقي.</div>
      <h3 class="section-title" style="margin-top:6px">١ · الاسترجاع (Retrieval)</h3>
      <p class="section-sub">حلّل ما استرجعت — لا تلمحات في هذا الاختبار. شغّله مثل امتحان.</p>

      <div data-retrieval>
        ${retrieval.map((item, k) => `
          <div class="ex-card" data-rex="${k}">
            <div class="ex-head"><span class="ex-type">Retrieval</span><span class="ex-note">${esc(item.c.title)}</span></div>
            <div class="ex-q">${esc(item.ex.q)}</div>
            <div class="opts">
              ${item.ex.options.map((o, oi) => `<div class="opt" data-opt="${oi}"><span class="opt-bullet">${oi+1}</span><span>${esc(o)}</span></div>`).join('')}
            </div>
            <div class="ex-foot">
              <button class="btn small" data-check>تحقق</button>
              <span class="pill empty" data-status>غير مفحل</span>
            </div>
            <div class="ex-feedback" data-fb></div>
          </div>`).join('')}
      </div>

      <h3 class="section-title" style="margin-top:26px">٢ · كشف الأفكار الخاطئة (Misconception Check)</h3>
      <p class="section-sub">اختر صحيح/خطأ لكل عبارة — ثم اقرأ التصويب بتمعّن.</p>
      <div class="miscon-list">
        ${mc.map((mm, k) => `
          <div class="miscon" data-miscon="${k}" data-correct="${mm.correct?'1':'0'}">
            <span class="tf">؟</span>
            <div>
              ${esc(mm.s)}
              <div class="mis-why">💡 ${esc(mm.why)}</div>
            </div>
          </div>`).join('')}
      </div>

      <h3 class="section-title" style="margin-top:26px">٣ · النقل (Transfer)</h3>
      <p class="section-sub">اختر أي مفهوم من هذه الوحدة، ثم قفم بتطبيقه: مثال، برنامج، أو سيناريو من حياتك.</p>
      <div class="map-grid">
        ${f.map((x, i3) => `<button class="map-chip" data-transfer="${i3}">${esc(x.con.title)}</button>`).join('')}
      </div>
      <textarea data-transfer-box placeholder="الكتابة هنا: تطبيقك الشخصي للمفهوم المختار…" style="width:100%;border:1.5px solid var(--line);border-radius:12px;padding:12px;font-size:14px;line-height:1.8;min-height:90px;margin-top:12px;outline:0"></textarea>
      <div class="ex-foot" style="margin-top:12px"><button class="btn small" data-transfer-save>💾 حفظ نقلي</button><span class="pill empty" data-transfer-st>محلياً</span></div>
      <p class="section-sub" style="margin-top:8px"><strong>أنت الآن قادر على:</strong> ${(meta.skills||[]).map(x => `<span class="pill good" style="margin:0 3px">${esc(x)}</span>`).join('')}</p>

      <div class="ex-foot" style="margin-top:20px">
        <button class="btn btn-inv" data-act="dashboard">لوحة التحكم</button>
        ${nextUnitId(uId) ? `<button class="btn" data-act="learn" data-unit="${esc(nextUnitId(uId))}" data-pos="0">الوحدة التالية ←</button>` : ''}
      </div>
    </div>
  </section>`;
}
function nextUnitId(uId){
  const ids = Object.keys(META.units);
  const i = ids.indexOf(uId);
  return i >= 0 && i < ids.length - 1 ? ids[i+1] : null;
}
function initUnitEnd(hub){
  observeReveals(hub);
  const s = App.state;
  hub.querySelectorAll('[data-rex]').forEach((card, k) => {
    const f = unitConcepts(s.unitId);
    const fs = [];
    f.forEach(x => (x.con.exercises||[]).forEach((ex,i2)=>{ if(ex.type==='mcq') fs.push({c:x.con, ex, i2}); }));
    const item = fs[+card.dataset.rex >= fs.length ? fs.length-1 : +card.dataset.rex];
    if(!item) return;
    const optEls = $a(card, '.opt');
    const check = card.querySelector('[data-check]');
    const status = card.querySelector('[data-status]');
    const fb = card.querySelector('[data-fb]');
    let sel = -1, done = false;
    optEls.forEach((o, oi) => o.addEventListener('click', () => { if(done) return; sel = oi; optEls.forEach(x => x.classList.toggle('sel', x===o)); }));
    check.addEventListener('click', () => {
      if(sel < 0){ fb.className='ex-feedback show bad'; fb.textContent = 'اختر إجابة أولاً.'; return; }
      const ok = item.ex.answer === sel;
      optEls.forEach((o, oi) => { o.classList.toggle('ok', oi===item.ex.answer); o.classList.toggle('bad', oi===sel && !ok); });
      fb.className = 'ex-feedback show ' + (ok?'ok':'bad');
      fb.textContent = ok ? '✅ صحيح! استرجاع ممتاز.' : '❌ ليس صحيحاً — راجع «'+item.c.title+'» في المرجع.';
      if(ok){ done = true; status.textContent = 'محلول ✓'; status.className='pill good'; }
    });
  });
  hub.querySelectorAll('[data-miscon]').forEach(m => {
    m.addEventListener('click', () => {
      const correct = m.dataset.correct === '1';
      const tf = m.querySelector('.tf');
      tf.textContent = correct ? '✓ صحيح' : '✗ خاطئ';
      tf.className = 'tf ' + (correct?'t-true':'t-false');
      m.classList.add('answered');
    });
  });
  hub.querySelectorAll('[data-transfer]').forEach(b => {
    b.addEventListener('click', () => {
      const f = unitConcepts(s.unitId);
      const x = f[+b.dataset.transfer];
      const box = hub.querySelector('[data-transfer-box]');
      box.value = 'مفهوم: ' + x.con.title + ' — ';
      box.focus();
    });
  });
  hub.querySelector('[data-transfer-save]').addEventListener('click', () => {
    const box = hub.querySelector('[data-transfer-box]');
    Progress.get().transfers = Progress.get().transfers || [];
    Progress.get().transfers.push({ u:s.unitId, t: new Date().toISOString(), note: box.value });
    Progress.touched();
    const st = hub.querySelector('[data-transfer-st]');
    st.textContent = 'محفوظ ✓'; st.className = 'pill good';
  });
}

/* ============================== REFERENCE ============================== */
function refHTML(uId, secId, conId){
  const ids = Object.keys(META.units);
  const secs = unitSections(uId);
  return `
  <div class="ref-wrap">
    <div class="topband">
      <h3>المرجع الأكاديمي</h3>
      <button class="ghost-btn small" data-act="learn" data-unit="${esc(uId)}" data-pos="0" style="margin-inline-start:auto">↩ العودة لـ«أتعلم»</button>
    </div>
    <div class="ref-notes">📚 هذا النمط يحاكي بنية المقرر الرسميّ: صياغات أكاديمية حرفية مع مفردات باللاتينية — تفستخدم للمراجعة والبحث، والنمط التفاعلي للتعلم العميق.</div>
    <div style="display:grid;grid-template-columns:250px 1fr;gap:22px">
      <div class="toc-side">
        ${ids.map(u => `
          <div class="toc-u">
            <button data-acco="${esc(u)}" style="${u===uId?'color:var(--acc)':''}">${META.units[u].icon} الوحدة ${u} · ${esc(META.units[u].title)} <span style="float:left">${u===uId?'▼':'▸'}</span></button>
            ${u===uId ? `<div class="toc-c">
              ${secs.map(sSec => `
                <button data-act="ref" data-unit="${esc(uId)}" data-sec="${esc(sSec.id)}" ${sSec.id===secId?'style="color:var(--acc);font-weight:700"':''}>${esc(sSec.label)} — ${esc(sSec.title)}</button>
              `).join('')}
            </div>` : ''}
          </div>`).join('')}
      </div>
      <div data-ref-content>
        <div class="hero reveal in" style="padding:26px 26px">
          <h1 style="margin:0;font-size:24px;margin-bottom:6px">${META.units[uId].icon} الوحدة ${uId} · ${esc(META.units[uId].title)}</h1>
          <p style="margin:0;color:#d4d4d8">${esc(META.units[uId].question)}</p>
        </div>
        ${secs.map(sSec => {
          return `
          <div style="margin-top:26px">
            <div class="section-title" style="margin-top:10px">📖 ${esc(sSec.title)}</div>
            <p class="section-sub" style="margin-bottom:14px">${esc(sSec.summary)}</p>
            ${(sSec.concepts||[]).map(c => `
              <div id="ref-${c.id}" class="gg-card" style="margin-bottom:14px;cursor:default;box-shadow:var(--shadow-s)">
                <h4>${c.icon?c.icon+' ':''}${esc(c.title)}<span class="gg-x">${esc(sSec.label)}</span></h4>
                <div class="tag-ls" style="display:inline-block;margin-bottom:8px">LEARNING SUPPORT</div>
                <p>${esc(c.explanation)}</p>
                <div style="border-top:1px solid var(--line);padding-top:12px;margin-top:12px;display:flex;gap:10px;align-items:center;flex-wrap:wrap">
                  <button class="ghost-btn small" data-act="learn" data-unit="${esc(uId)}" data-pos="${flatPos(uId, sSec.id, c.id)}">🌱 تعلمه تفاعلياً</button>
                  <span class="pill empty">مصطلحات: ${esc((termsOf(c)).slice(0,6).join(' ، '))}</span>
                </div>
              </div>`).join('')}
          </div>`;
        }).join('')}
      </div>
    </div>
  </div>`;
}
function initRefPage(hub){
  observeReveals(hub);
}

/* ============================== SEARCH ============================== */
function searchHTML(q){
  return `
  <section class="page page-narrow">
    <h1 style="font-size:26px;font-weight:900;margin:4px 0 2px">البحث في المقرر</h1>
    <p class="section-sub">ابحث في محتوى كل الوحدات، المصطلحات، والأمثلة بكلمة أو أكثر.</p>
    <div class="search-field">
      <input type="search" data-q placeholder="مثال: قاعدة البيانات، خوارزمية، حلقة for…" value="${esc(q||'')}" autofocus>
      <button data-search>بحث</button>
    </div>
    <div class="search-slot" data-results data-qidx="${esc(q||'')}"></div>
  </section>`;
}
function initSearchPage(hub){
  const input = hub.querySelector('[data-q]');
  const btn = hub.querySelector('[data-search]');
  const res = hub.querySelector('[data-results]');
  const run = (q) => {
    q = (q||'').trim().toLowerCase();
    if(!q){ res.innerHTML = '<span class="pill empty">اكتب كلمة للبحث</span>'; return; }
    const idx = searchIndex();
    const tokens = q.split(/\s+/);
    const found = idx.filter(x => {
      const hay = (x.title + ' ' + x.text + ' ' + x.loc + ' ' + (x.type==='term'?x.term:'')).toLowerCase();
      return tokens.every(t => hay.indexOf(t) >= 0);
    }).slice(0, 40);
    if(!found.length){ res.innerHTML = '<div class="sg-item" style="cursor:default"><div class="sg-t">لا نتائج</div><div class="sg-x">جرّب كلمة أخرى أو تصفح المرجع.</div></div>'; return; }
    res.innerHTML = found.map(x => {
      let act = '';
      if(x.type === 'term'){ act = 'glossary'; }
      else if(x.type === 'unit'){ act = 'unit'; }
      else act = 'learn';
      const payload = `data-gotofx="${esc(act)}" data-unit="${esc(x.uId||'')}" ${x.secId?`data-sec="${esc(x.secId)}"`:''} ${x.conId?`data-con="${esc(x.conId)}"`:''}`;
      const label = x.type === 'unit' ? 'وحدة' : x.type === 'section' ? 'قسم' : x.type === 'term' ? 'مصطلح' : 'مفهوم';
      return `<div class="sg-item" ${payload}>
        <div class="sg-loc">${label} · ${esc(x.loc)}</div>
        <div class="sg-t">${esc(x.title)}</div>
        <div class="sg-x">${esc((x.text||'').slice(0, 160))}…</div>
      </div>`;
    }).join('');
  };
  run(input.value);
  btn.addEventListener('click', () => run(input.value));
  input.addEventListener('keyup', (e) => { if(e.key === 'Enter'){ run(input.value); } });
}

/* ============================== GLOSSARY ============================== */
function glossaryHTML(){
  const g = Object.keys(GLOSSARY).sort((a,b)=>a.localeCompare(b,'ar'));
  return `
  <section class="page">
    <h1 style="font-size:26px;font-weight:900;margin:4px 0 2px">دليل المصطلحات</h1>
    <p class="section-sub">المصطلحات اللاتينية كما وردت في المقرر، مع مقابلها بعربية واضحة.</p>
    <div class="gg-grid">
      ${g.map(t => `<div class="gg-card reveal" data-goto="search" data-gotoq="${esc(t)}">
        <h4>${esc(t)}</h4>
        <p>${esc(GLOSSARY[t])}</p>
      </div>`).join('')}
    </div>
  </section>`;
}

/* ============================== DASHBOARD ============================== */
function dashboardHTML(){
  const P = Progress.get();
  const t = totalConcepts(), d = totalDone(), pct = t? Math.round(d/t*100):0;
  const units = Object.keys(META.units).map(uId => {
    const m = META.units[uId];
    const un = Progress.unit(uId);
    const tt = unitConcepts(uId).length;
    const dd = Object.keys(un.done||{}).length;
    const ss = unitSolvedCount(uId);
    return { uId, m, tt, dd, ss, pct: tt?Math.round(dd/tt*100):0 };
  });
  const transfers = (P.transfers||[]).length;
  return `
  <section class="page page-narrow">
    <div class="topband"><h1 style="margin:0;font-size:26px">لوحة التحكم</h1><div class="mode-tabs">
        <button class="${P.freebrowse?'':'active'}" data-fb="0">🚶 تقدم متسلسل</button>
        <button class="${P.freebrowse?'active':''}" data-fb="1">🕊️ تجوال حر</button>
      </div></div>
    <div class="stat-row">
      <div class="stat-card"><div class="st-n">${pct}%</div><div class="st-l">الإنجاز الكلي</div></div>
      <div class="stat-card"><div class="st-n">${d}/${t}</div><div class="st-l">مفاهيم مكتملة</div></div>
      <div class="stat-card"><div class="st-n">${units.filter(u=>u.pct>=100).length}/6</div><div class="st-l">وحدات منجزّة</div></div>
      <div class="stat-card"><div class="st-n">${transfers}</div><div class="st-l">ملاحظات نقل محفوظة</div></div>
    </div>
    <div>${globalProgressBar(true)}</div>
    <h3 class="section-title">الوحدات</h3>
    <div class="dash-rows">
      ${units.map(u => `
        <div class="dash-row" data-act="learn" data-unit="${esc(u.uId)}" data-pos="${Math.min(Progress.unit(u.uId).last||0, u.tt-1)}">
          <div class="dr-ic">${u.m.icon}</div>
          <div><div class="dr-t">الوحدة ${u.uId} · ${esc(u.m.title)}</div>
          <div class="dr-s">${u.dd}/${u.tt} مفهوماً · ${u.ss} تمريناً محلوَلاً</div></div>
          <div class="pb-track" style="width:120px"><div class="pb-fill" style="width:${u.pct}%"></div></div>
        </div>`).join('')}
    </div>
    <h3 class="section-title">المهارات</h3>
    <div class="map-grid">
      ${Array.from(new Set(Object.keys(META.units).reduce((a,u)=>a.concat(META.units[u].skills||[]),[]))).map(s => `<span class="map-chip">${esc(s)}</span>`).join('')}
    </div>
    <div style="margin-top:26px;display:flex;gap:10px;flex-wrap:wrap">
      <button class="btn btn-ghost" data-goto="glossary">📖 دليل المصطلحات</button>
      <button class="btn btn-ghost" data-goto="ref">📚 المرجع</button>
      <button class="btn btn-ghost" data-resetprog style="color:var(--bad)">🗑️ إعادة ضبط التقدم</button>
    </div>
  </section>`.replace('PLACEHOLDER_PROG', '');
}
function globalProgressBar(showLabel){
  const t = totalConcepts(), d = totalDone(), pct = t? Math.round(d/t*100):0;
  return `<div style="display:flex;align-items:center;gap:10px;margin-bottom:14px">
    <span class="pill good">${pct}%</span>
    <div class="pb-track" style="flex:1"><div class="pb-fill" style="width:${pct}%"></div></div>
    <span style="font-size:12px;color:var(--mut)">${d}/${t} من إجمالي المفاهيم</span></div>`;
}

/* ============================== GLOBAL DELEGATION ============================== */
function bindGlobal(){
  document.addEventListener('click', (e) => {
    const t = e.target.closest('[data-goto], [data-act], [data-gotoq], [data-goto-pos], [data-unit-nav], [data-acco], [data-fb], [data-resetprog]');
    if(!t) return;

    if(t.hasAttribute('data-resetprog')){
      if(confirm('إعادة ضبط كل التقدم؟')){
        localStorage.removeItem(Progress.KEY);
        Progress.data = null;
        render();
      }
      return;
    }
    if(t.hasAttribute('data-fb')){
      const d = Progress.get();
      d.freebrowse = t.dataset.fb === '1';
      Progress.save();
      render();
      return;
    }
    if(t.hasAttribute('data-acco')){
      const u = t.dataset.acco;
      App.go('ref', { unitId: u });
      return;
    }
    if(t.hasAttribute('data-goto')){
      const g = t.dataset.goto;
      if(g === 'learn'){ App.go('learn', { unitId:'01', pos:0 }); }
      else if(g === 'ref'){ App.go('ref', { unitId:'01' }); }
      else App.go(g);
      return;
    }
    if(t.hasAttribute('data-gotoq')){
      App.go('search', { q: t.dataset.gotoq });
      return;
    }
    const act = t.dataset.act;
    const u = t.dataset.unit;
    if(act === 'learn' && u){
      App.go('learn', { unitId: u, pos: +(t.dataset.pos||0) });
      return;
    }
    if(act === 'unit' && u){ App.go('unit', { unitId: u }); return; }
    if(act === 'unitend' && u){ App.go('unitend', { unitId: u }); return; }
    if(act === 'ref'){
      App.go('ref', { unitId: u || '01', secId: t.dataset.sec, conId: t.dataset.con });
      return;
    }
    if(act === 'dashboard'){ App.go('dashboard'); return; }
    if(act === 'glossary'){ App.go('glossary'); return; }
    if(act === 'search'){ App.go('search'); return; }
  });

  document.addEventListener('DOMContentLoaded', () => {
    Progress.load();
    Progress.onChange = () => render();
    const lp = Progress.get().lastPos;
    if(lp && META.units[lp.u]){
      App.state = { name:'learn', unitId: lp.u, pos: lp.p || 0 };
    } else {
      App.state = { name:'home' };
    }
    render();
  });

  if(document.readyState !== 'loading'){ boot(); }
}

let booted = false;
function boot(){
  if(booted) return; booted = true;
  Progress.load();
  Progress.onChange = () => render();
  const lp = Progress.get().lastPos;
  if(lp && META.units[lp.u]){
    App.state = { name:'learn', unitId: lp.u, pos: lp.p || 0 };
  } else {
    App.state = { name:'home' };
  }
  render();
}
if(document.readyState === 'loading'){ document.addEventListener('DOMContentLoaded', boot); } else { boot(); }

/* ============================== HELPERS ============================== */
function mappingIdLabel(){}

document.addEventListener('click', (e) => {
  const t = e.target.closest('[data-goto-pos]');
  if(t){ App.go('learn', { unitId: t.dataset.unit, pos: +t.dataset.pos }); }
});
document.addEventListener('keydown', (e) => {
  if(e.key === 'Escape'){ /* noop */ }
});

