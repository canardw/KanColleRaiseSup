/* ユーティリティ等 */
if(typeof(dpnla) == 'undefined'){
var dpnla = {
	dat: new Array(),	//データ保存用
	init: function(){
	/* 初期化 */
		this.tabinit(0,'t01');
		this.tabinit(2,'t31');
		this.tabinit(0,'t51');
		var cl = this.ge('pmb02');
		if(cl != undefined) this.addevent(cl,'click',function(){ dpnla.pmbclose(); });
	},
	tabinit: function(pt,id){
	/* タブ初期化
	 * 動作フラグ加算値(1の場合、左の値を加算する)
	 * 1:ページの(←)マイナス(→)プラス…0)なし、1)あり
	 * 2:２ヶ所の画面切替が…0)なし、1)あり
	 */
		var i = 0;	var j = 1;	var fg = new Array();
		for(i = 0;i < 2;i++){
			if(i > 0) j = Math.pow(2,i);
			fg[i] = pt & j;
		}
		this.dat[id +'_fg'] = fg;
		var ky = id +'_ns';		var ns = this.dat[ky];
		if(ns == undefined) this.dat[ky] = 0;
		var tb = this.getn(this.ge(id),'li');
		this.dat[id +'_li'] = tb;		var mx = tb.length;
		for(i = 0;i < mx;i++){
			j = i + 1;	ky = id +'_'+ j;
			if(i > 0) this.tabdyset(ky,'none',fg);
			this.addevent(tb[i],'click',function(e){ dpnla.tabclik(e); return dpnla.evtcancel(e); });
		}
		if(fg[0] > 0) mx -= 2;
		this.dat[id +'_mx'] = mx;
	},
	tabclik: function(e){
	/* タブクリック */
		var em = e.target;
		while(em.tagName.toLowerCase() != 'li'){
			em = em.parentNode;
		}
		var ep = em.parentNode;		var id = ep.id;
		var fg = this.dat[id +'_fg'];		var po = 0;
		var tb = this.dat[id +'_li'];		var tm = tb.length - 1;
		for(i = 0;i <= tm;i++){
			if(tb[i] == em){
				po = i;		break;
			}
		}
		var pa = this.posget(id);		var mx = pa[0];		var ns = pa[1];
		if(fg[0] > 0){
			if(po == 0){
				po = ns - 1;
				if(po < 0) po = 0;
			}else if(po == tm){
				po = ns + 1;
				if(po >= mx) po = mx - 1;
			}else{
				po--;
			}
		}
		this.tabsel(id,po);
	},
	evtcancel: function(e){
	/* イベントのキャンセル */
		if(!e) return false;
		e.stopPropagation();	e.preventDefault();
		return false;
	},
	tabsel: function(id,po){
	/* タブ選択 */
		var fg = this.dat[id +'_fg'];		var i = 0;	var j = 0;	var ky = '';
		var tb = this.dat[id +'_li'];		var tm = tb.length - 1;
		if(fg[0] > 0){
			j = po + 1;
			if(tb[j].className != 'active'){
				for(i = 1;i < tm;i++){
					tb[i].className = '';
					ky = id +'_'+ i;	this.tabdyset(ky,'none',fg);
				}
				tb[j].className = 'active';
				ky = id +'_'+ j;	this.tabdyset(ky,'block',fg);
			}
		}else{
			if(tb[po].className != 'active'){
				for(i = 0;i <= tm;i++){
					tb[i].className = '';
					j = i + 1;	ky = id +'_'+ j;	this.tabdyset(ky,'none',fg);
				}
				tb[po].className = 'active';
				j = po + 1;		ky = id +'_'+ j;	this.tabdyset(ky,'block',fg);
			}
		}
		this.dat[id +'_ns'] = po;
	},
	tabdyset: function(ky,vl,fg){
	/* タブ本体状態設定 */
		var oa = this.ge(ky);
		if(oa != undefined) oa.style.display = vl;
		if(fg[1] > 0){
			ky += '_a';		oa = this.ge(ky);
			if(oa != undefined) oa.style.display = vl;
		}
	},
	tabdef: function(id){
	/* タブ記憶選択 */
		var po = this.defget(id);
		this.tabsel(id,po);
	},
	defget: function(id){
	/* 選択記憶取得 */
		var pa = this.posget(id);
		var mx = pa[0];		var po = pa[1];
		if(po >= mx) po = mx - 1;
		return po;
	},
	posget: function(id){
	/* 選択記憶＆最大取得 */
		var pa = new Array();
		var ky = id +'_mx';		pa[0] = this.dat[ky];
				ky = id +'_ns';		pa[1] = this.dat[ky];
		return pa;
	},
	tmpget: function(id){
	/* テンプレート取得 */
		var ob = this.ge(id);		var tp = '<!--_%DLIMT%_-->';
		if(ob != undefined) tp = ob.innerHTML;
		return tp.split('<!--_%DLIMT%_-->');
	},
	tmprep: function(pt,ra,tp){
	/* テンプレート置換
	 * 動作フラグ加算値(1の場合、左の値を加算する)
	 * 1:置換文字列の個数…0)1個、1)複数個
	 * 2:文字列か配列か…0)文字列、1)配列
	 * 4:配列の次元数…0)一次元、1)二次元
	 */
		var i = 0;	var j = 1;	var fg = new Array();
		for(i = 0;i < 3;i++){
			if(i > 0) j = Math.pow(2,i);
			fg[i] = pt & j;
		}
		var ht = tp;	var ky = '';	var rg = null;
		if(fg[1] > 0){
			if(fg[0] > 0){
				if(fg[2] > 0){
					for(i = 0;i < ra.length;i++){
						for(j = 0;j < ra[i].length;j++){
							ky = '_%va'+ i +'_'+ j +'%_';		rg = new RegExp(ky,"g");	ht = ht.replace(rg,ra[i][j]);
						}
					}
				}else{
					for(i = 0;i < ra.length;i++){
						ky = '_%va'+ i +'%_';		rg = new RegExp(ky,"g");	ht = ht.replace(rg,ra[i]);
					}
				}
			}else{
				if(fg[2] > 0){
					for(i = 0;i < ra.length;i++){
						for(j = 0;j < ra[i].length;j++){
							ky = '_%va'+ i +'_'+ j +'%_';		ht = ht.replace(ky,ra[i][j]);
						}
					}
				}else{
					for(i = 0;i < ra.length;i++){
						ky = '_%va'+ i +'%_';		ht = ht.replace(ky,ra[i]);
					}
				}
			}
		}else{
			if(fg[0] > 0){
				rg = new RegExp('_%va0%_',"g");		ht = ht.replace(rg,ra);
			}else{
				ht = ht.replace('_%va0%_',ra);
			}
		}
		return ht;
	},
	tmpviw: function(pt,id,ht){
	/* テンプレート表示 pt 0:上書き 1:追記(イベント消失注意) */
		var ob = this.ge(id);		var ha = '';
		if(ob != undefined){
			if(pt > 0) ha = ob.innerHTML;
			ob.innerHTML = ha + ht;
		}
	},
	tmpagemk: function(id,mx){
	/* ページ切替タブ作成 */
		var tp = this.tmpget('tp0_1');	var i = 0;
		var ht = this.tmprep(0,id,tp[0]);		ht += tp[1];
		if(mx > 1){
			for(i = 2;i <= mx;i++){
				ht += this.tmprep(0,i,tp[2]);
			}
		}
		ht += tp[3];
		return ht;
	},
	tmptabmk: function(id,rb){
	/* 通常タブ作成 */
		var tp = this.tmpget('tp0_2');	var i = 0;	var mx = rb.length;
		var ht = this.tmprep(0,id,tp[0]);		ht += this.tmprep(0,rb[0],tp[1]);
		if(mx > 1){
			for(i = 1;i < mx;i++){
				ht += this.tmprep(0,rb[i],tp[2]);
			}
		}
		ht += tp[3];
		return ht;
	},
	tab14init: function(vl){
	/* 戦闘タブ初期化 */
		this.tmpviw(0,'c41',vl);	this.tmpviw(0,'c42','&nbsp;');
		this.tmpviw(0,'c43','&nbsp;');	this.tmpviw(0,'c44','');
		this.tmpviw(0,'c45','');	this.tmpviw(0,'c47','');
	},
	pmbopen: function(la,ta,wa,ha,hb){
	/* ポップアップメッセージボックスを開く */
		var po = this.ge('pmb01');	var mo = this.ge('pmb03');
		if(mo != undefined) mo.innerHTML = hb;
		if(po != undefined){
			po.style.left = la +'px';		po.style.top = ta +'px';
			po.style.width = wa +'px';	po.style.height = ha +'px';
			po.style.display = 'block';
		}
	},
	pmbclose: function(){
	/* ポップアップメッセージボックスを閉じる */
		var po = this.ge('pmb01');
		if(po != undefined){
			po.style.display = 'none';
			po.style.left = '0px';	po.style.top = '0px';
			po.style.width = '1px';		po.style.height = '1px';
		}
	},
	daytimchg: function(p,d){
	/* 日付オブジェクトの値を日時文字列に変換する */
		var a = new Array();	var r = '';		var i = 0;
		a[0] = d.getYear();		a[1] = d.getMonth() + 1;	a[2] = d.getDate();
		if(a[0] < 2000) a[0] += 1900;
		a[3] = d.getHours();	a[4] = d.getMinutes();	a[5] = d.getSeconds();
		for(i = 1;i < 6;i++){
			if(a[i] < 10) a[i] = '0'+ a[i];
		}
		switch(p){
		 case 1:	// 12/31 23:59
			r = a[1] +'/'+ a[2] +' '+ a[3] +':'+ a[4];	break;
		 case 2:	// 12/31 23:59:59
			r = a[1] +'/'+ a[2] +' '+ a[3] +':'+ a[4] +':'+ a[5];		break;
		 default:	// 2014/12/31 23:59:59
			r = a[0] +'/'+ a[1] +'/'+ a[2] +' '+ a[3] +':'+ a[4] +':'+ a[5];	break;
		}
		return r;
	},
	strtimchg: function(tm){
	/* ミリ秒の値を時分秒に変換する */
		var a = new Array();	var i = 0;
		a[0] = Math.floor(tm / 1000);		a[1] = Math.floor(a[0] / 60);
		a[2] = Math.floor(a[1] / 60);		a[3] = a[0] % 60;		a[4] = a[1] % 60;
		for(i = 2;i < 5;i++){
			if(a[i] < 10) a[i] = '0'+ a[i];
		}
		return a[2] +':'+ a[4] +':'+ a[3];
	},
	addevent: function(em,ty,fc){
	/* エレメントへのイベント追加 */
		if(window.addEventListener){
			em.addEventListener(ty,fc,false);
		}else{
			var ev = 'on'+ ty;
			if(window.attachEvent){
				em.attachEvent(ev,fc);
			}else{
				em[ev] = fc;
			}
		}
	},
	getn: function(em,tg){
	/* エレメント内のタグ取得 */
		return em.getElementsByTagName(tg);
	},
	ge: function(id){
	/* エレメントの取得 */
		return document.getElementById(id);
	}
};
}
dpnla.addevent(window,'load',function(){ dpnla.init(); /* 初期起動 */ });