// -*- coding: utf-8 -*-
var $ship_list		= load_storage('ship_list');
var $enemy_list		= load_storage('enemy_list');
var $mst_ship		= load_storage('mst_ship');
var $mst_slotitem	= load_storage('mst_slotitem');
var $mst_mission	= load_storage('mst_mission');
var $mst_useitem	= load_storage('mst_useitem');
var $mst_mapinfo	= load_storage('mst_mapinfo');
var $weekly			= load_storage('weekly');
var $logbook		= load_storage('logbook', []);
var $slotitem_list = {};
var $max_ship = 0;
var $max_slotitem = 0;
var $combined_flag = 0;
var $fdeck_list = {};
var $ship_fdeck = {};
var $ship_escape = {};	// 護衛退避したshipidのマップ.
var $escape_info = null;
var $next_mapinfo = null;
var $next_enemy = null;
var $is_boss = false;
var $material = {};
var $quest_count = -1;
var $quest_exec_count = 0;
var $quest_list = {};
var $battle_count = 0;
var $ndock_list = {};
var $kdock_list = {};
var $enemy_id = null;
var $enemy_formation_id = 0;
var $battle_log = [];
var $last_mission = {};
var $beginhps = null;
var $beginhps_c = null;
var $f_damage = 0;
var $guess_win_rank = '?';
var $guess_info_str = '';

//-------------------------------------------------------------------------
// Ship クラス.
function Ship(data, ship) {
	this.p_cond	= (ship) ? ship.c_cond : 49;
	this.c_cond	= data.api_cond;
	this.maxhp	= data.api_maxhp;
	this.nowhp	= data.api_nowhp;
	this.slot	= data.api_slot;	// []装備ID.
	this.onslot	= data.api_onslot;	// []装備数.
	this.bull	= data.api_bull;	// 弾薬.
	this.fuel	= data.api_fuel;	// 燃料.
	this.id		= data.api_id;		// 背番号.
	this.lv		= data.api_lv;
	this.locked	= data.api_locked;
	this.ndock_time	= data.api_ndock_time;
	this.ship_id	= data.api_ship_id;
	this.kyouka	= data.api_kyouka;	// 近代化改修による強化値[火力,雷装,対空,装甲,運].
	this.sortno	= data.api_sortno;
	this.nextlv	= data.api_exp[1];
	this.slot_flg = 0;
}

Ship.prototype.name_lv = function() {
	return ship_name(this.ship_id) + ' Lv' + this.lv;
};

Ship.prototype.fuel_name = function() {
	var max = $mst_ship[this.ship_id].api_fuel_max;		var ra = ['',''];
	var rc = ['<span class="label label-success">','</span>'];
	if (max && this.fuel < max) {
		var rb = percent_name(this.fuel, max);
		ra[0] = rc[0] + rb.substring(0,1) + rc[1];	ra[1] = rc[0] + rb + rc[1];
	}
	return ra;
};

Ship.prototype.bull_name = function() {
	var max = $mst_ship[this.ship_id].api_bull_max;		var ra = ['',''];
	var rc = ['<span class="label ts9">','</span>'];
	if (max && this.bull < max) {
		var rb = percent_name(this.bull, max);
		ra[0] = rc[0] + rb.substring(0,1) + rc[1];	ra[1] = rc[0] + rb + rc[1];
	}
	return ra;
};

Ship.prototype.can_kaizou = function() {
	var afterlv = $mst_ship[this.ship_id].api_afterlv;
	return afterlv && afterlv <= this.lv;
};

Ship.prototype.max_kyouka = function() {
	var mst = $mst_ship[this.ship_id];
	return [
		mst.api_houg[1] - mst.api_houg[0],	// 火力.
		mst.api_raig[1] - mst.api_raig[0],	// 雷装.
		mst.api_tyku[1] - mst.api_tyku[0],	// 対空.
		mst.api_souk[1] - mst.api_souk[0]		// 装甲.
/*	mst.api_luck[1] - mst.api_luck[0]	*/	// 運.
	];
};

Ship.prototype.begin_shipid = function() {
	var mst = $mst_ship[this.ship_id];
	return mst.yps_begin_shipid ? mst.yps_begin_shipid : this.ship_id;
};

Ship.prototype.slot_names = function() {
	var slot = this.slot;
	var onslot = this.onslot;
	var maxslot = $mst_ship[this.ship_id].api_maxeq;
	var a = ['','','',''];
	for (var i = 0; i < slot.length; ++i) {
		var value = $slotitem_list[slot[i]];
		if (value) {
			a[i] = slotitem_name(value.item_id, value.level, onslot[i], maxslot[i]);
		}
	}
	return a;
}

Ship.prototype.onslot_name = function() {
	var mx = $mst_ship[this.ship_id].api_maxeq;		var ra = ['',''];
	var rc = ['<span class="label label-warning">','</span>'];
	var sc = 0;		var sm = 0;
	for(var i in this.onslot){
		sc += this.onslot[i];		sm += mx[i];
	}
	if(sm && sc < sm){
		var rb = percent_name(sc,sm);
		ra[0] = rc[0] + rb.substring(0,1) + rc[1];	ra[1] = rc[0] + rb + rc[1];
	}
	return ra;
};
//------------------------------------------------------------------------
// データ保存と更新.
//
function load_storage(name, def) {
	if (!def) def = {};
	var v = localStorage[name];
	return v ? JSON.parse(v) : def;
}

function save_storage(name, v) {
	localStorage[name] = JSON.stringify(v);
}

function update_ship_list(list, is_all) {
	if (!list) return;
	// update ship_list
	var prev_ship_list = $ship_list;
	if (is_all) $ship_list = {};
	list.forEach(function(data) {
		$ship_list[data.api_id] = new Ship(data, prev_ship_list[data.api_id]);
		if (is_all) {
			data.api_slot.forEach(function(id) {
				// 未知の装備があれば、ダミーエントリを作って数を合わせる. 戦闘直後のship2にて、ドロップ艦がこの状況となる.
				if (id != -1 && !$slotitem_list[id]) $slotitem_list[id] = { item_id: -1, locked: 0, level: 0 };
			});
		}
	});
	save_storage('ship_list', $ship_list);
}

function update_enemy_list() {
	save_storage('enemy_list', $enemy_list);
}

function update_fdeck_list(list) {
	if (!list) return;
	$fdeck_list = {};
	$ship_fdeck = {};
	list.forEach(function(deck) {
		$fdeck_list[deck.api_id] = deck;
		for (var i in deck.api_ship) {
			var ship_id = deck.api_ship[i];
			if (ship_id != -1) $ship_fdeck[ship_id] = deck.api_id;
		}
	});
}

function update_ndock_list(list) {
	if (!list) return;
	$ndock_list = {};
	list.forEach(function(data) {
		var ship_id = data.api_ship_id;
		if (ship_id) $ndock_list[ship_id] = data;
	});
}

function update_kdock_list(list) {
	if (!list) return;
	$kdock_list = {};
	list.forEach(function(data) {
		// state: -1:未開放, 0:空き, 1:不明, 2:建造中, 3:完成.
		if (data.api_state >= 2) $kdock_list[data.api_id] = data;
	});
}

function update_mst_ship(list) {
	if (!list) return;
	$mst_ship = {};
	var before = {};
	list.forEach(function(data) {
		$mst_ship[data.api_id] = data;
		if (data.api_aftershipid)
			before[data.api_aftershipid] = data.api_id;
	});
	for (var id in $mst_ship) {
		var b = before[id];
		if (b) {
			$mst_ship[id].yps_before_shipid = b; // 改装前の艦種ID.
			do {
				$mst_ship[id].yps_begin_shipid = b; // 未改装の艦種ID.
			} while (b = before[b]);
		}
	}
	save_storage('mst_ship', $mst_ship);
}

function update_mst_slotitem(list) {
	if (!list) return;
	$mst_slotitem = {};
	list.forEach(function(data) {
		$mst_slotitem[data.api_id] = data;
	});
	save_storage('mst_slotitem', $mst_slotitem);
}

function update_mst_mission(list) {
	if (!list) return;
	$mst_mission = {};
	list.forEach(function(data) {
		$mst_mission[data.api_id] = data;
	});
	save_storage('mst_mission', $mst_mission);
}

function update_mst_useitem(list) {
	if (!list) return;
	$mst_useitem = {};
	list.forEach(function(data) {
		$mst_useitem[data.api_id] = data;
	});
	save_storage('mst_useitem', $mst_useitem);
}

function update_mst_mapinfo(list) {
	if (!list) return;
	$mst_mapinfo = {};
	list.forEach(function(data) {
		$mst_mapinfo[data.api_id] = data;
	});
	save_storage('mst_mapinfo', $mst_mapinfo);
}

function get_weekly() {
	var wn = Date.now() - Date.UTC(2013, 4-1, 22, 5-9, 0); // 2013-4-22 05:00 JST からの経過ミリ秒数.
	wn = Math.floor(wn / (7*24*60*60*1000)); // 経過週数に変換する.
	if ($weekly == null || $weekly.week != wn) {
		$weekly = {
			quest_state : 0, // あ号任務状況(1:未遂行, 2:遂行中, 3:達成)
			sortie    : 0,
			boss_cell : 0,
			win_boss  : 0,
			win_S     : 0,
			week      : wn
		};
	}
	return $weekly;
}

function save_weekly() {
	save_storage('weekly', $weekly);
}

function push_to_logbook(log) {
	if ($logbook.push(log) > 50) $logbook.shift(); // 50を超えたら古いものから削除する.
	save_storage('logbook', $logbook);
}

function fraction_name(num, denom) {
	if (num >= denom)
		return '達成';
	else
		return num + '/' + denom;
}

//------------------------------------------------------------------------
// 表示文字列化.
//
function weekly_name() {
	var w = get_weekly();
	return ' 【出撃数： '+ fraction_name(w.sortie, 36)
		+'，ボス勝利： '+ fraction_name(w.win_boss, 12)
		+'，<br /><span class="mb11"></span>ボス到達： '+ fraction_name(w.boss_cell, 24)
		+'，S勝利： '+ fraction_name(w.win_S, 6)
		+' 】';
}

function diff_name(now, prev) {		// now:1, prev:2 -> "(-1)"
	var diff = now - prev;
	if (!prev) return '';
	else if (diff > 0) return '+'+ diff; // with plus sign
	else if (diff < 0) return ''+ diff; // with minus sign
	else /* diff == 0 */ return '';
}

function percent_name(now, max) {	// now:1, prev:2 -> "50%"
	if (!max) return '';
	return Math.floor(100 * now / max) + '%';
}

function percent_name_unless100(now, max) {	// now:1, max:2 -> "(50%)"
	if (!max || now == max) return '';
	return '(' + percent_name(now, max) + ')';
}

function fraction_percent_name(now, max) {	// now:1, max:2 -> "1/2(50%)"
	return now + '/' + max + '(' + percent_name(now, max) + ')';
}

function kira_name(cond) {
	if(cond > 84){
		return '<span class="cr5">'+ cond +'</span>'; // 三重キラ
	}else if(cond > 52){
		return '<span class="cr4">'+ cond +'</span>'; // 回避向上キラ
	}else if(cond > 49){
		return '<span class="cr13">'+ cond +'</span>'; // キラ
	}else if(cond == 49){
		return ''; // normal
	}else if(cond < 20){
		return '<span class="cr8">'+ cond +'</span>'; // 赤疲労
	}else if(cond < 30){
		return '<span class="cr7">'+ cond +'</span>'; // 橙疲労
	}else{
		return ''+ cond; // recovering 疲労
	}
}

function material_name(id) {
	switch (id) {
		case 1: return '燃料';
		case 2: return '弾薬';
		case 3: return '鋼材';
		case 4: return 'ボーキ';
		case 5: return '高速建造材';	// バーナー.
		case 6: return '高速修復材';	// バケツ.
		case 7: return '開発資材';	// 歯車.
		case 8: return '改修資材';	// ネジ.
		case 10: return '家具箱小';
		case 11: return '家具箱中';
		case 12: return '家具箱大';
		default: return 'id(' + id + ')';
	}
}

function formation_name(id) {
	switch (parseInt(id, 10)) {	// 連合艦隊戦闘では id が数値ではなく文字列になっている.
		case 1: return '単縦';
		case 2: return '複縦';
		case 3: return '輪形';
		case 4: return '梯形';
		case 5: return '単横';
		case 11: return '連合対潜警戒';
		case 12: return '連合前方警戒';
		case 13: return '連合輪形陣';
		case 14: return '連合戦闘隊形';
		default: return id.toString();
	}
}

function match_name(id) {
	switch (id) {
		case 1: return '同航';
		case 2: return '反航';
		case 3: return 'Ｔ字有利';
		case 4: return 'Ｔ字不利';
		default: return id.toString();
	}
}

function support_name(id) {	///@param id	支援タイプ api_support_flag
	switch (id) {
		case 1: return '航空支援';
		case 2: return '支援射撃';
		case 3: return '支援長距離雷撃';
		default: return id.toString();
	}
}

function seiku_name(id) {	///@param id	制空権 api_disp_seiku
	switch (id) {
		case 1: return '制空権確保';
		case 2: return '航空優勢';
		case 0: return '航空互角';
		case 3: return '航空劣勢';
		case 4: return '制空権喪失';
		default: return id.toString();
	}
}

function search_name(id) {	///@param id	索敵結果 api_search[]
	switch (id) {
		case 1: return '敵艦隊発見!';
		case 2: return '敵艦隊発見!索敵機未帰還機あり';
		case 3: return '敵艦隊発見できず…索敵機未帰還機あり';
		case 4: return '敵艦隊発見できず…';
		case 5: return '敵艦隊発見!(索敵機なし)';
		case 6: return 'なし';
		default: return id.toString();
	}
}

function mission_clear_name(cr) {	///@param c	遠征クリア api_clear_result
	switch (cr) {
		case 1: return '成功';
		case 2: return '大成功';
		default: return '失敗';
	}
}

function slotitem_name(id, lv, n, max) {
	var item = $mst_slotitem[id];
	if (!item) return id.toString();	// unknown slotitem.
	var name = item.api_name;
	if (lv >= 1) name += '★+' + lv;	// 改修レベルを追加する.
	if (is_airplane(item) && n) name = '【'+ n +' '+ percent_name_unless100(n, max) +'】 '+ name; // 航空機なら、機数と搭載割合を追加する.
	return name;
}

function slotitem_names(idlist) {
	if (!idlist) return '';
	var a = idlist.map(function(id) {
		return slotitem_name(id);
	});
	return a.join('，');
}

function ship_name(id) {
	var ship = $mst_ship[id];
	if (ship) {
		id = ship.api_name;
		if (ship.api_sortno == 0 && ship.api_yomi.length > 1) {
			id += ship.api_yomi; // 'elite', 'flag ship' ...
		}
	}
	return id.toString();
}

function get_fdeck_num(id) {
	var rt = '';
	var fdeck = $ship_fdeck[id]; // 頭に艦隊番号を付ける.
	if (fdeck) rt = '<span class="label label-primary ts10">'+ fdeck +'</span>';
	return rt;
}

function shiplist_names(list) {	// Shipの配列をlv降順に並べて、","区切りの艦名Lv文字列化する.
	list.sort(function(a, b) { return (b.lv == a.lv) ? a.id - b.id : b.lv - a.lv; }); // lv降順、同一lvならid昇順(古い順)でソートする.
	var names = [];
	var last = null;
	for (var i in list) {
		if (!last || last.ship != list[i]) names.push(last = {count:0, ship:list[i]});
		last.count++;
	}
	for (var i in names) {
		var e = names[i];
		var name = e.ship.name_lv();
		var fdeck = get_fdeck_num(e.ship.id);
		if (fdeck != '') name = fdeck +' '+ name;
		if (e.count > 1) name += "x" + e.count;	// 同一艦は x N で束ねる.
		names[i] = name;
	}
	return names.join(', ');
}

function damage_name(nowhp, maxhp) {
	var r = nowhp / maxhp;
	return (r <= 0) ? '<span class="label label-primary">撃沈</span>'
		: (r <= 0.25) ? '<span class="label label-danger">大破</span>'
		: (r <= 0.50) ? '<span class="label label-default">中破</span>'
		: (r <= 0.75) ? '<span class="label label-default">小破</span>'
		: (r <= 0.85) ? '<span class="label label-default"><i class="icon-wrench mr0"></i></span>' // 軽微2.
		: (r <  1.00) ? '<span class="label label-default ts10"><i class="icon-wrench mr0"></i></span>' // 軽微1.
		: ''; // 無傷.
}

//------------------------------------------------------------------------
// データ解析.
//
function decode_postdata_params(params) {
	var r = {};
	if (!params) return;
	params.forEach(function(data) {
		var name  = decodeURI(data.name);
		var value = decodeURI(data.value);
		if (name && value) r[name] = value;
	});
	return r;
}

function count_if(a, value) {
	if (a instanceof Array)
		return a.reduce(function(count, x) { return count + (x == value); }, 0);
	else
		return (a == value) ? 1 : 0;
}

function count_unless(a, value) {
	if (a instanceof Array)
		return a.reduce(function(count, x) { return count + (x != value); }, 0);
	else
		return (a != value) ? 1 : 0;
}

function add_slotitem_list(data) {
	if (!data) return;
	if (data instanceof Array) {
		data.forEach(function(e) {
			add_slotitem_list(e);
		});
	}
	else if (data.api_slotitem_id) {
		$slotitem_list[data.api_id] = { item_id: data.api_slotitem_id, locked: data.api_locked, level: data.api_level };
	}
}

function slotitem_count(slot, item_id) {
	if (!slot) return 0;
	var count = 0;
	for (var i = 0; i < slot.length; ++i) {
		var value = $slotitem_list[slot[i]];
		if (value && count_if(item_id, value.item_id)) ++count;
	}
	return count;
}

function slotitem_use(slot, item_id) {
	if (!slot) return 0;
	for (var i = 0; i < slot.length; ++i) {
		var value = $slotitem_list[slot[i]];
		if (value && count_if(item_id, value.item_id)) {
			slot[i] = -1; return true;
		}
	}
	return false;
}

function slotitem_delete(slot) {
	if (!slot) return;
	slot.forEach(function(id) {
		delete $slotitem_list[id];
	});
}

function ship_delete(list) {
	if (!list) return;
	list.forEach(function(id) {
		var ship = $ship_list[id];
		if (ship) {
			slotitem_delete(ship.slot);
			delete $ship_list[id];
		}
	});
}

function is_airplane(item) {
	if (!item) return false;
	switch (item.api_type[2]) {
	case 6:	// 艦上戦闘機.
	case 7:	// 艦上爆撃機.
	case 8:	// 艦上攻撃機.
	case 9:	// 艦上偵察機.
	case 10:// 水上偵察機.
	case 11:// 水上爆撃機.
	case 25:// オートジャイロ.
	case 26:// 対潜哨戒機.
		return true;
	default:
		return false;
	}
}

function push_fleet_status(tp, deck) {
	var lv_sum = 0;
	var fleet_ships = 0;
	var drumcan = {ships:0, sum:0, msg:''};
	var rt = ['','',''];	var rb = new Array();
	var j = 0;	var ra = new Array();
	for(j = 0;j < 19;j++){
		ra[j] = '';
	}
	for (var i = 0, ship, s_id; ship = $ship_list[s_id = deck.api_ship[i]]; ++i) {
		fleet_ships++;
		lv_sum += ship.lv;
		ra[6] = '';
		ra[17] = '';
		if (ship.nowhp < ship.maxhp) {
			ra[6] = damage_name(ship.nowhp, ship.maxhp); // ダメージ.
			ra[17] = dpnla.strtimchg(ship.ndock_time); // 修理所要時間.
		}
		if ($ship_escape[s_id]) {
			ra[6] = tp[2][7];
		}
		var ndock = $ndock_list[s_id];
		if (ndock) {
			var c_date = new Date(ndock.api_complete_time);
			ra[6] = tp[2][6];		ra[17] = '【'+ ndock.api_id +' 】 '+ dpnla.daytimchg(1,c_date);
		}
		ra[0] = kira_name(ship.c_cond);		ra[1] = ship_name(ship.ship_id);
		ra[2] = ship.lv;	ra[3] = ship.nextlv;	ra[4] = ship.nowhp;		ra[5] = ship.maxhp;
		rb = ship.fuel_name();	ra[7] = rb[0];	ra[10] = rb[1];
		rb = ship.bull_name();	ra[8] = rb[0];	ra[11] = rb[1];
		rb = ship.onslot_name();	ra[9] = rb[0];	ra[12] = rb[1];
		rb = ship.slot_names();		ra[13] = rb[0];		ra[14] = rb[1];		ra[15] = rb[2];		ra[16] = rb[3];
		ra[18] = diff_name(ship.c_cond, ship.p_cond);
		rt[0] += dpnla.tmprep(2,ra,tp[0][1]);
		rt[1] += dpnla.tmprep(2,ra,tp[1][1]);
		var d = slotitem_count(ship.slot, 75);	// ドラム缶.
		if (d) {
			drumcan.ships++;
			drumcan.sum += d;
		}
	}
	if (drumcan.sum) {
		drumcan.msg = 'ドラム缶x' + drumcan.sum + '個 (' + drumcan.ships + '隻) ';
	}
	rt[2] = drumcan.msg +'合計 Lv'+ lv_sum +' ('+ fleet_ships +'隻)';
	return rt;
}

//------------------------------------------------------------------------
// イベントハンドラ.
//
function on_port(json) {
	var unlockitem_list = {};
	var unlock_names = [];
	var lock_condlist = [];
	var lock_kyoukalist = [];
	var lock_beginlist = {};
	var lock_repairlist = [];
	var cond85 = 0;
	var cond53 = 0;
	var cond50 = 0;
	var unlock_lv10 = 0;
	var damage_H = 0;
	var damage_M = 0;
	var damage_L = 0;
	var damage_N = 0;
	var kaizou_list = [];
	var lockeditem_list = {};
	var lockeditem_count = 0;
	var unlock_slotitem = 0;
	var leveling_slotitem = 0;
	var i = 0;	var j = 0;	var ky = '';	var ht = '';	var ra = new Array();
	var tp = new Array();		var tb = new Array();
	var ca = 0;		var cb = 0;		var cc = 0;		var cd = 0;
	var mb = ['','','','','','','',''];		var mc = ['資材増減数 ： ','','','',''];
	//
	// ロック装備を種類毎に集計する.
	for (var id in $slotitem_list) {
		var value = $slotitem_list[id];
		if (value) {
			var i = value.item_id;
			var lv = value.level;
			if(value.locked){
				if (!lockeditem_list[i]) lockeditem_list[i] = [];
			if (!lockeditem_list[i][lv])
				lockeditem_list[i][lv] = {count:0, shiplist:[]};
			lockeditem_list[i][lv].count++;
			lockeditem_count++;
			}else{
				if(i != -1){
					if(!unlockitem_list[i]) unlockitem_list[i] = [];
					if(!unlockitem_list[i][lv]) unlockitem_list[i][lv] = { count:0 };
					unlockitem_list[i][lv].count++;
				}
			}
		}
		if (value && value.level) {
			leveling_slotitem++;
		}
	}
	//
	// ロック艦のcond別一覧、未ロック艦一覧、ロック装備持ち艦を検出する.
	for (var id in $ship_list) {
		var ship = $ship_list[id];
		lock_condlist.push(ship);
		if (!ship.locked) {
			var n = count_unless(ship.slot, -1); // スロット装備数.
			unlock_slotitem += n;
			
			ship.slot_flg = n; // 装備持ちなら.
			unlock_names.push(ship);
			if (ship.lv >= 10) unlock_lv10++;
		}
		else {	// locked
			var cond = ship.c_cond;
			if      (cond >= 85) cond85++; // 三重キラ.
			else if (cond >= 53) cond53++; // 回避向上キラ.
			else if (cond >  49) cond50++; // キラ.
			var max_k = ship.max_kyouka();
			var flg_k = 0;
			for (var i in max_k) {
				if (max_k[i] > ship.kyouka[i]) flg_k = 1;
			}
			if(flg_k > 0) lock_kyoukalist.push(ship);
			if (!$ndock_list[id] && ship.nowhp < ship.maxhp) {
				var r = ship.nowhp / ship.maxhp;
				if      (r <= 0.25) damage_H++; // 大破.
				else if (r <= 0.50) damage_M++; // 中破.
				else if (r <= 0.75) damage_L++; // 小破.
				else                damage_N++; // 軽微.
				lock_repairlist.push(ship);
			}
			var b = ship.begin_shipid();
			if (!lock_beginlist[b]) lock_beginlist[b] = [];
			lock_beginlist[b].push(ship);
		}
		if (ship.slot) {
			ship.slot.forEach(function(id) {
				var value = $slotitem_list[id];
				if (value && value.locked)
					lockeditem_list[value.item_id][value.level].shiplist.push(ship);
			});
		}
		if (ship.can_kaizou()) kaizou_list.push(ship);
	}
	var double_count = 0;
	for (var id in lock_beginlist) {
		var a = lock_beginlist[id];
		if (a.length > 1) double_count += a.length - 1; // ダブリ艦数を集計する.
	}
	//
	// 艦娘と装備数を検出する.
	var basic = json.api_data.api_basic;
	if (basic) {
		$max_ship     = basic.api_max_chara;
		$max_slotitem = basic.api_max_slotitem + 3;
		$combined_flag = json.api_data.api_combined_flag;
	}
	mb[3] = $max_ship;	mb[5] = $max_slotitem;
	//
	// 資材変化を表示する.
	var material = json.api_data.api_material;
	ky = '';
	if (material) {
		material.forEach(function(data) {
			var id = data.api_id;
			var value = data.api_value;
			var diff  = diff_name(value, $material[id]);
			$material[id] = value;
			if (diff.length) {
				mc[0] += ky + material_name(id) +' '+ diff;		ky = ' ，';
			}
		});
	}
	//
	// 艦娘保有数、未ロック艦一覧、改造可能艦一覧、ロック艦キラ付一覧を表示する.
	var ships = Object.keys($ship_list).length;
	var space = $max_ship - ships;
	if (space <= 0) {
		mb[0] = ' cr6';		mc[1] += '艦娘保有数が満杯です。 '; // 警告表示.
	} else if (space < 5) {
		mb[0] = ' cr6';		mc[1] += '艦娘保有数の上限まで残り 【'+ space +' 】 '; // 警告表示.
	}
	if (unlock_lv10) mc[1] += 'Lv10以上の未ロック艦があります。 '; // 警告表示.
	mb[2] = ships;	mb[6] = unlock_names.length;	mb[7] = unlock_slotitem;
	// 全艦一覧
	tb = dpnla.tmpget('tp3_6');		tp = dpnla.tmpget('tp3_1');
	if (lock_condlist.length > 0) {
		lock_condlist.sort(function(a,b){
			var aa = $mst_ship[a.ship_id];
			var bb = $mst_ship[b.ship_id];
			var rt = bb.api_stype - aa.api_stype;
			if(!rt) rt = a.sortno - b.sortno;
			if(!rt) rt = b.lv - a.lv;
			if(!rt) rt = a.id - b.id;
			return rt;
		});
		ky = 't32';		ca = 0;		cb = 1;		cc = 3;		cd = 1;
		ht = '<div id="'+ ky +'_1">';
		for (var i in lock_condlist) {
			var ship = lock_condlist[i];
			ra[0] = get_fdeck_num(ship.id);		ra[1] = kira_name(ship.c_cond);
			ra[2] = ship_name(ship.ship_id);	ra[3] = ship.lv;
			ra[4] = ship.nextlv;	ra[5] = '';		ra[6] = '';
			if(ship.locked){
				mc[2] += ra[3] +'\t'+ ra[2] +'\n';
			}else{
				ra[5] = tb[1];
			}
			if(ship.nowhp < ship.maxhp){ // ダメージ.
				ra[6] = tb[2];
				var ndock = $ndock_list[ship.id];
				if (ndock) ra[6] = tb[5];
			}
			if(ca == 0){
				if(cb > cc){
					cb = 1;		cd++;
				}
				if(cb == 1 && cd > 1) ht += '</div><div id="'+ ky +'_'+ cd +'" class="hid">';
				ht += tp[0];
			}
			ht += dpnla.tmprep(2,ra,tp[1]);		ca++;
			if(ca > 9){
				ca = 0;		cb++;		ht += tp[2];
			}
		}
		if(ca > 0) ht += tp[2];
		ht += '</div>';
		dpnla.tmpviw(0,'t31_1_a',ht);
		dpnla.tmpviw(0,'t31_1',dpnla.tmpagemk(ky,cd));
		dpnla.tabinit(1,ky);	dpnla.tabdef(ky);
		dpnla.ge('c55').value = mc[2];
	}else{
		dpnla.tmpviw(0,'t31_1_a','');		dpnla.tmpviw(0,'t31_1','');
	}
	// 未ロック艦一覧
	if (unlock_names.length > 0) {
		unlock_names.sort(function(a,b){
			var rt = a.lv - b.lv;
			if(!rt) rt = b.sortno - a.sortno;
			if(!rt) rt = b.id - a.id;
			return rt;
		});
		tp = dpnla.tmpget('tp3_2');
		ky = 't33';		ca = 0;		cb = 1;		cc = 3;		cd = 1;
		ht = '<div id="'+ ky +'_1">';		ra = new Array();
		for (var i in unlock_names) {
			var ship = unlock_names[i];
			ra[0] = get_fdeck_num(ship.id);		ra[1] = kira_name(ship.c_cond);
			ra[2] = ship_name(ship.ship_id);	ra[3] = ship.lv;
			ra[4] = ship.nextlv;	ra[5] = '';		ra[6] = '';		ra[7] = '';
			if(ship.nowhp < ship.maxhp){ // ダメージ.
				ra[6] = tb[2];
				var ndock = $ndock_list[ship.id];
				if (ndock) ra[6] = tb[5];
			}
			if(ship.slot_flg > 0) ra[7] = tb[3];
			if(ca == 0){
				if(cb > cc){
					cb = 1;		cd++;
				}
				if(cb == 1 && cd > 1) ht += '</div><div id="'+ ky +'_'+ cd +'" class="hid">';
				ht += tp[0];
			}
			ht += dpnla.tmprep(2,ra,tp[1]);		ca++;
			if(ca > 9){
				ca = 0;		cb++;		ht += tp[2];
			}
		}
		if(ca > 0) ht += tp[2];
		ht += '</div>';
		dpnla.tmpviw(0,'t31_2_a',ht);
		dpnla.tmpviw(0,'t31_2',dpnla.tmpagemk(ky,cd));
		dpnla.tabinit(1,ky);	dpnla.tabdef(ky);
	}else{
		dpnla.tmpviw(0,'t31_2_a','');		dpnla.tmpviw(0,'t31_2','');
	}
	// ロック艦ダブリ一覧
	if (double_count > 0) {
		tp = dpnla.tmpget('tp5_2');
		ht = dpnla.tmprep(0,double_count,tp[0]);
		for (var id in lock_beginlist) {
			var a = lock_beginlist[id];
			if (a.length > 1) ht += dpnla.tmprep(0,shiplist_names(a),tp[1]);
		}
		ht += tp[2];	mc[3] = ht;
	}
	//
	// 装備数、ロック装備一覧を表示する.
	var items = Object.keys($slotitem_list).length;
	var space = $max_slotitem - items;
	if (space <= 0) {
		mb[1] = ' cr6';		mc[1] += '装備保有数が満杯です。 '; // 警告表示.
	} else if (space < 20) {
		mb[1] = ' cr6';		mc[1] += '装備保有数の上限まで残り 【'+ space +' 】 '; // 警告表示.
	}
	tp = dpnla.tmpget('tp1_1');		mb[4] = items;
	dpnla.tmpviw(0,'c01',dpnla.tmprep(2,mb,tp[0]));
	// ロック装備一覧
	var lockeditem_ids = Object.keys(lockeditem_list);
	if (lockeditem_ids.length > 0) {
		lockeditem_ids.sort(function(a, b) {	// 種別ID配列を表示順に並べ替える.
			var aa = $mst_slotitem[a];
			var bb = $mst_slotitem[b];
			var ret = aa.api_type[2] - bb.api_type[2]; // 装備分類の大小判定.
			if (!ret) ret = aa.api_sortno - bb.api_sortno; // 分類内の大小判定.
			// if (!ret) ret = a - b; // 種別ID値での大小判定.
			return ret;
		});
		tp = dpnla.tmpget('tp5_1');		ca = 0;		cb = 0;
		ra = [lockeditem_count,leveling_slotitem];
		ht = dpnla.tmprep(2,ra,tp[0]);	ra = ['','','','','','','',''];
		lockeditem_ids.forEach(function(id) {
			for (var lv in lockeditem_list[id]) {
				var item = lockeditem_list[id][lv];
				if(ca == 0 && cb > 0){
					ht += dpnla.tmprep(2,ra,tp[1]);		ra = ['','','','','','','',''];
				}
				i = ca * 4;		ra[i] = slotitem_name(id, lv);	ra[(i + 1)] = item.shiplist.length;
				ra[(i + 2)] = item.count;		ra[(i + 3)] = shiplist_names(item.shiplist);	ca++;
				if(ca > 1){
					ca = 0;		cb++;
				}
			}
		});
		ht += dpnla.tmprep(2,ra,tp[1]) + tp[2];
		dpnla.tmpviw(0,'t51_1',ht);
	}else{
		dpnla.tmpviw(0,'t51_1','');
	}
	// アンロック装備一覧
	var unlockitem_ids = Object.keys(unlockitem_list);
	if (unlockitem_ids.length > 0) {
		unlockitem_ids.sort(function(a, b) {	// 種別ID配列を表示順に並べ替える.
			var aa = $mst_slotitem[a];
			var bb = $mst_slotitem[b];
			var ret = aa.api_type[2] - bb.api_type[2]; // 装備分類の大小判定.
			if (!ret) ret = aa.api_sortno - bb.api_sortno; // 分類内の大小判定.
			return ret;
		});
		tp = dpnla.tmpget('tp5_5');		ca = 0;		cb = 0;
		ra = [(items - lockeditem_count),leveling_slotitem];
		ht = dpnla.tmprep(2,ra,tp[0]);	ra = ['','','','','',''];
		unlockitem_ids.forEach(function(id) {
			for (var lv in unlockitem_list[id]) {
				var item = unlockitem_list[id][lv];
				if(ca == 0 && cb > 0){
					ht += dpnla.tmprep(2,ra,tp[1]);		ra = ['','','','','',''];
				}
				i = ca * 2;		ra[i] = slotitem_name(id, lv);	ra[(i + 1)] = item.count;		ca++;
				if(ca > 2){
					ca = 0;		cb++;
				}
			}
		});
		ht += dpnla.tmprep(2,ra,tp[1]) + tp[2];
		dpnla.tmpviw(0,'t51_2',ht);
	}else{
		dpnla.tmpviw(0,'t51_2','');
	}
	//
	// 改造可能一覧、近代化改修一可能覧を表示する.
	var kaizou_count = kaizou_list.length;	ht = '';
	if (kaizou_count > 0) {
		tp = dpnla.tmpget('tp5_3');
		ht = dpnla.tmprep(0,kaizou_count,tp[0]);
		for (var i in kaizou_list) {
			var ship = kaizou_list[i];
			var sname = ship.name_lv();
			var fdeck = get_fdeck_num(ship.id);
			if (fdeck != '') sname = fdeck +' '+ sname;
			ht += dpnla.tmprep(0,sname,tp[1]);
		}
		ht += tp[2];
	}
	ht = mc[3] + ht;	dpnla.tmpviw(0,'t51_3',ht);
	// 近代化改修可能艦一覧(ロック艦のみ)
	var kyouka_count = [0,0,0,0];
	if (lock_kyoukalist.length > 0) {
		lock_kyoukalist.sort(function(a,b){
			var rt = b.lv - a.lv;
			if(!rt) rt = b.sortno - a.sortno;
			if(!rt) rt = b.id - a.id;
			return rt;
		});
		tp = dpnla.tmpget('tp3_4');		var ka = 0;		var kb = 0;		var kc = 0;
		ky = 't35';		ca = 0;		cb = 1;		cc = 2;		cd = 1;
		ht = '<div id="'+ ky +'_1">';	ra = new Array();
		for (var i in lock_kyoukalist) {
			var ship = lock_kyoukalist[i];
			ra[0] = get_fdeck_num(ship.id);		ra[1] = kira_name(ship.c_cond);
			ra[2] = ship_name(ship.ship_id);	ra[3] = ship.lv;	ra[4] = ship.nextlv;
			ra[5] = '';		ra[6] = '';		ra[7] = '';		ra[8] = '';
			var max_k = ship.max_kyouka();
			for (var j in max_k) {
				if (max_k[j] > ship.kyouka[j]) {
					ka = j - 0;		kb = ka + 5;	kc = ka + 6;
					kyouka_count[ka]++;		ra[kb] = tb[kc];
				}
			}
			if(ca == 0){
				if(cb > cc){
					cb = 1;		cd++;
				}
				if(cb == 1 && cd > 1) ht += '</div><div id="'+ ky +'_'+ cd +'" class="hid">';
				ht += tp[0];
			}
			ht += dpnla.tmprep(2,ra,tp[1]);		ca++;
			if(ca > 9){
				ca = 0;		cb++;		ht += tp[2];
			}
		}
		if(ca > 0) ht += tp[2];
		ht += '</div>';
		dpnla.tmpviw(0,'t31_4_a',ht);
		dpnla.tmpviw(0,'t31_4',dpnla.tmpagemk(ky,cd));
		dpnla.tabinit(1,ky);	dpnla.tabdef(ky);
	}else{
		dpnla.tmpviw(0,'t31_4_a','');		dpnla.tmpviw(0,'t31_4','');
	}
	//
	// 入渠(修理)一覧表示する.
	var ndocks = Object.keys($ndock_list).length;
	var repairs = lock_repairlist.length;
	if (ndocks > 0 || repairs > 0) {
		ky = 't34';		ca = 0;		cb = 1;		cc = 2;		cd = 1;
		ht = '<div id="'+ ky +'_1">';		ra = new Array();
		if (ndocks > 0) {
			tp = dpnla.tmpget('tp3_7');		ht += tp[0];
			for (var id in $ndock_list) {
				var d = $ndock_list[id];
				var ship = $ship_list[id];
				var c_date = new Date(d.api_complete_time);
				ra[0] = get_fdeck_num(ship.id);		ra[1] = kira_name(ship.c_cond);
				ra[2] = ship_name(ship.ship_id);	ra[3] = ship.lv;
				ra[4] = d.api_item1;	ra[5] = d.api_item2;	ra[6] = d.api_item3;
				ra[7] = d.api_item4;	ra[8] = tb[5];	ra[9] = dpnla.daytimchg(1,c_date);
				ht += dpnla.tmprep(2,ra,tp[1]);
			}
			ht += tp[2];		cb = 2;
		}
		if (repairs > 0) {
			tp = dpnla.tmpget('tp3_3');		ra = new Array();
			lock_repairlist.sort(function(a, b) { return b.ndock_time - a.ndock_time; }); // 修理所要時間降順で並べ替える.
			for (var i in lock_repairlist) {
				var ship = lock_repairlist[i];
				ra[0] = get_fdeck_num(ship.id);		ra[1] = kira_name(ship.c_cond);
				ra[2] = ship_name(ship.ship_id);	ra[3] = ship.lv;
				ra[4] = ship.nowhp;		ra[5] = ship.maxhp;
				ra[6] = damage_name(ship.nowhp, ship.maxhp); // ダメージ.
				ra[7] = dpnla.strtimchg(ship.ndock_time); // 修理所要時間.
				if(ca == 0){
					if(cb > cc){
						cb = 1;		cd++;
					}
					if(cb == 1 && cd > 1) ht += '</div><div id="'+ ky +'_'+ cd +'" class="hid">';
					ht += tp[0];
				}
				ht += dpnla.tmprep(2,ra,tp[1]);		ca++;
				if(ca > 9){
					ca = 0;		cb++;		ht += tp[2];
				}
			}
			if(ca > 0) ht += tp[2];
		}
		ht += '</div>';
		dpnla.tmpviw(0,'t31_3_a',ht);
		dpnla.tmpviw(0,'t31_3',dpnla.tmpagemk(ky,cd));
		dpnla.tabinit(1,ky);	dpnla.tabdef(ky);
	}else{
		dpnla.tmpviw(0,'t31_3_a','');		dpnla.tmpviw(0,'t31_3','');
	}
	//
	// 建造ドック一覧表示する.
	var kdocks = Object.keys($kdock_list).length;
	if (kdocks > 0) {
		tp = dpnla.tmpget('tp3_5');		ht = tp[0];		ra = new Array();
		for (var id in $kdock_list) {
			var k = $kdock_list[id];
			var c_date = new Date(k.api_complete_time);
			var complete = (k.api_state == 3 || c_date.getTime() < Date.now());	// api_state 3:完成, 2:建造中, 1:???, 0:空き, -1:未開放. ※ 1以下は$kdock_listに載せない.
			ra[0] = (complete ? '完成！！' : '建造中');		ra[1] = ship_name(k.api_created_ship_id);
			ra[2] = k.api_item1;	ra[3] = k.api_item2;	ra[4] = k.api_item3;	ra[5] = k.api_item4;
			ra[6] = k.api_item5;	ra[7] = (complete ? '' : dpnla.daytimchg(1,c_date));
			ht += dpnla.tmprep(2,ra,tp[1]);
		}
		ht += tp[2];
		dpnla.tmpviw(0,'t31_5_a',ht);
	}else{
		dpnla.tmpviw(0,'t31_5_a','');
	}
	//
	// 記録を表示する.
	if ($logbook.length > 0) {
		tp = dpnla.tmpget('tp5_4');		ht = tp[0];
		for (var i in $logbook) {
			ht += dpnla.tmprep(0,$logbook[i],tp[1]);
		}
		ht += tp[2];
		dpnla.tmpviw(0,'t51_4',ht);
	}else{
		dpnla.tmpviw(0,'t51_4','');
	}
	
	tp = dpnla.tmpget('tp1_2');		tb = dpnla.tmpget('tp1_3');
	var ha = '';	ht = dpnla.tmprep(0,mc[0],tp[0]);
	if(mc[1] != '') ht += dpnla.tmprep(0,mc[1],tp[1]);
	ht += tp[3];
	//
	// 遂行中任務を一覧表示する.
	var quests = Object.keys($quest_list).length;
	if (quests != $quest_count) {
		ht += dpnla.tmprep(0,'任務リストを先頭から最終ページまでめくってください。',tp[2]);
	}
	if (quests > 0) {
		ra = ['',''];
		for (var id in $quest_list) {
			var quest = $quest_list[id];
			if (quest.api_state > 1) {
				ra[0] = '';
				if(quest.api_state == 3){
					ra[0] = tb[8];
				}else if(quest.api_progress_flag == 2){
					ra[0] = tb[9];
				}else if(quest.api_progress_flag == 1){
					ra[0] = tb[10];
				}
				ra[1] = tb[quest.api_category] + quest.api_title;
				if (quest.api_no == 214) ra[1] += weekly_name();
				ha += dpnla.tmprep(2,ra,tp[5]);
			}
		}
		if (ha != '') {
			ra = [$quest_exec_count,$quest_count];
			ht += dpnla.tmprep(2,ra,tp[4]) + ha + tp[6];
		}
	}
	ht += tp[7];
	ra = [(ships - unlock_names.length),cond85,cond53,cond50];
	for(i = 0;i < 4;i++){
		j = i + 4;	ra[j] = kyouka_count[i];
	}
	ht += dpnla.tmprep(2,ra,tp[9]);
	if(ndocks > 0 || repairs > 0 || kdocks > 0){
		ra = ['','',damage_H,damage_M,damage_L,damage_N];
		if(ndocks > 0){
			ra[0] = dpnla.tmprep(0,ndocks,tp[11]);
		}else{
			ra[0] = dpnla.tmprep(0,'修理中：0',tp[13]);
		}
		if(kdocks > 0){
			ra[1] = dpnla.tmprep(0,kdocks,tp[12]);
		}else{
			ra[1] = dpnla.tmprep(0,'建造中：0',tp[13]);
		}
		ht += dpnla.tmprep(2,ra,tp[10]);
	}
	mc[3] = ht;		mc[4] = tp[8];
	//
	// 各艦隊の情報を一覧表示する.
	ht = ['','','','','',''];		ra = ['','','','',''];	var ma = ['全 艦 隊'];
	var md = new Array();		var me = new Array();		var ta = new Array();
	for(i = 0;i < 3;i++){
		j = i + 1;	ky = 'tp2_'+ j;		tp[i] = dpnla.tmpget(ky);
	}
	for (var f_id in $fdeck_list) {
		var deck = $fdeck_list[f_id];		ky = '';	ra[0] = '';		ra[1] = '';		ra[4] = 'info';
		if ($combined_flag && f_id < 3) {
			ky = '◆';	ra[0] = '【連合】 ';	ra[4] = 'primary';
		}
		ky += deck.api_name;	ma.push(ky);	ra[0] += deck.api_name;		ra[2] = tp[2][2];
		ta = push_fleet_status(tp, deck);
		var mission_end = deck.api_mission[2];
		if (mission_end > 0) {
			var d = new Date(mission_end);
			var id = deck.api_mission[1];
			me = new Array();		me[0] = f_id;		me[1] = id;
			me[2] = $mst_mission[id].api_name;	me[3] = dpnla.daytimchg(1,d);
			ra[1] = tp[2][1];		ra[2] += tp[2][4] +' '+ me[3] +' ';
			ra[3] = '遠征 【'+ id +' 】 '+ me[2] +' ： '+ me[3];	md.push(me);
		}
		else if (deck.api_id == $battle_deck_id) {
			ra[3] = '出撃中：'+ $battle_log.join(' →') +' →';
		}
		else {
			if ($last_mission[f_id])
				ra[3] = $last_mission[f_id];
			else
				ra[3] = '母港待機中';
		}
		ra[2] += ta[2] + tp[2][3];
		ht[0] += dpnla.tmprep(2,ra,tp[0][0]) + ta[0] + tp[0][2];
		ht[f_id] = dpnla.tmprep(2,ra,tp[1][0]) + ta[1] + dpnla.tmprep(0,ra[3],tp[1][2]);
	}
	for(i = 0;i < 5;i++){
		j = i + 1;	ky = 't21_'+ j;		dpnla.tmpviw(0,ky,ht[i]);
	}
	dpnla.tmpviw(0,'c21',dpnla.tmptabmk('t21',ma));
	dpnla.tabinit(0,'t21');		dpnla.tabdef('t21');
	if(md.length > 0){ // 遠征中リスト構築
		tp = dpnla.tmpget('tp1_4');		mc[3] += tp[0];		me = new Array();
		for(i = 0;i < md.length;i++){
			me = md[i];		me[0] = tp[3] + me[0] + tp[4];
			mc[3] += dpnla.tmprep(2,me,tp[1]);
		}
		mc[3] += tp[2];
	}
	mc[3] += mc[4];
	dpnla.tmpviw(0,'t01_1',mc[3]);
	if(ndocks > 0){
		dpnla.addevent(dpnla.ge('b12n'),'click',function(){ dpnla.tabsel('t01',2); dpnla.tabsel('t31',2); });
	}
	if(kdocks > 0){
		dpnla.addevent(dpnla.ge('b12k'),'click',function(){ dpnla.tabsel('t01',2); dpnla.tabsel('t31',4); });
	}
}

function on_mission_check(category) {
	var tp = dpnla.tmpget('tp0_3');		var tb = dpnla.tmpget('tp1_3');
	var ra = ['',tb[category] +'任務チェック'];		var rb = ['','',''];
	var ht = '';	var ha = '';	var rc = 0;
	var qc = Object.keys($quest_list).length;
	if(qc > 0){
		for (var id in $quest_list) {
			var quest = $quest_list[id];
			if (quest.api_category == category) {	// 1:編成, 2:出撃, 3:演習, 4:遠征, 5:補給入渠, 6:工廠.
				rb[0] = '';		rb[1] = quest.api_title;	rb[2] = tb[12];
				if(quest.api_state == 3){
					rb[0] = tb[8];	rb[2] = '';
					if(rc < 2) rc = 1;
				}else if(quest.api_state == 1){
					rb[2] = tb[13];		rc = 2;
				}else if(quest.api_progress_flag == 2){
					rb[0] = tb[9];
				}else if(quest.api_progress_flag == 1){
					rb[0] = tb[10];
				}
				ha += dpnla.tmprep(2,rb,tp[1]);
			}
		}
	}
	switch(rc){
	 case 1:
		ra[0] = '達成している任務があります。';		break;
	 case 2:
		ra[0] = '未チェックの任務があります。';		break;
	}
	if (qc != $quest_count){
		ra[0] = '任務リストを先頭から最終ページまでめくってください。';		rc = 3;
	}
	ht = dpnla.tmprep(2,ra,tp[0]) + ha + tp[2];
	if(rc > 0) dpnla.pmbopen(220,40,380,170,ht);
}

function on_next_cell(json) {
	var d = json.api_data;
	var e = json.api_data.api_enemy;
	var g = json.api_data.api_itemget;
	var h = json.api_data.api_happening;
	var area = d.api_maparea_id + '-' + d.api_mapinfo_no + '-' + d.api_no;
	var arow = ' <i class="icon-arrow-right"></i>';
	$next_mapinfo = $mst_mapinfo[d.api_maparea_id * 10 + d.api_mapinfo_no];
	if (e) {
		$enemy_id = e.api_enemy_id;
		var msg = $enemy_id.toString(10);
		var fleet = $enemy_list[$enemy_id];
		if (d.api_event_id == 5) {
			area += '(boss)';
			$is_boss = true;
		}
		$next_enemy = area + ':' + $enemy_id;
		if (fleet) {
			var tp = dpnla.tmpget('tp4_1');		var ha = '';
			var ra = ['','','','','',''];		var rb = new Array();
			for(var i = 1;i < fleet.length;i++){
				ra[0] = i;	rb = fleet[i].split('Lv');
				ra[1] = rb[0];	ra[2] = rb[1];
				ha += dpnla.tmprep(2,ra,tp[1]);
			}
			ra[0] = fleet[0];		ra[1] = '&nbsp;';
			var hb = fleet.join(',');
			if(/潜水.級/.test(hb)) ra[1] = tp[5];
			ha = tp[0] + ha + tp[2];
			dpnla.tmpviw(0,'c45',dpnla.tmprep(2,ra,ha));
		}
		dpnla.tmpviw(1,'c41',arow +'Enemy '+ area +' '+ msg);
		dpnla.tmpviw(0,'c43','&nbsp;');
	}
	if (g) {
		var msg = material_name(g.api_id) + 'x' + g.api_getcount;
		dpnla.tmpviw(1,'c41',arow +'Item '+ area +' '+ msg);
	}
	if (h) {
		var msg = material_name(h.api_mst_id) + 'x' + h.api_count;
		if (h.api_dentan) msg += '(電探により軽減あり)';
		dpnla.tmpviw(1,'c41',arow +'Loss '+ area +' '+ msg);
	}
}

/// 護衛退避艦リストに艦IDを追加する. idx = 1..6, 7..12
function add_ship_escape(idx) {
	if (idx >= 7)
		$ship_escape[$fdeck_list[2].api_ship[idx-7]] = 1; // 第ニ艦隊から退避.
	else if (idx >= 1)
		$ship_escape[$fdeck_list[1].api_ship[idx-1]] = 1; // 第一艦隊から退避.
}

/// 護衛退避実行. 退避可能リストから１艦、護衛可能リストから１艦、合計2艦のみ退避できる.
function on_goback_port() {
	if (!$escape_info) return;
	add_ship_escape($escape_info.api_escape_idx[0]);	// 退避可能艦一覧の最初の艦を退避リストに追加する.
	add_ship_escape($escape_info.api_tow_idx[0]);		// 護衛可能艦一覧の最初の艦を退避リストに追加する.
}

function on_battle_result(json) {
	var d = json.api_data;
	var e = d.api_enemy_info;
	var g = d.api_get_ship;
	var h = d.api_get_useitem;
	var mvp   = d.api_mvp;
	var mvp_c = d.api_mvp_combined;
	var lost  = d.api_lost_flag;
	var tp = dpnla.tmpget('tp4_1');
	var msg = tp[3] +'battle result'+ tp[4];
	var drop_ship_name = g ? g.api_ship_type + '：' + g.api_ship_name : null;
	var drop_item_name = h ? $mst_useitem[h.api_useitem_id].api_name : null;
	$escape_info = d.api_escape;	// on_goback_port()で使用する.
	if (e) {
		var rank = d.api_win_rank;
		var e_name = e.api_deck_name;
		var e_fmat = formation_name($enemy_formation_id);
		dpnla.tmpviw(0,'c46',e_name +'('+ e_fmat +')');
		msg += e_name;
		if (d.api_ship_id) {
			var total = count_unless(d.api_ship_id, -1);
			msg += '(' + d.api_dests + '/' + total + ')';
			if (rank == 'S' && $f_damage == 0) rank = '完S';
		}
		msg += '：'+ rank;
		$guess_info_str += ', rank:' + rank;
		if (rank != $guess_win_rank) {
			$guess_info_str += '/' + $guess_win_rank + ' MISS!!';
			msg += '<br />'+ tp[9] +'勝敗推定ミス'+ tp[8] +' '+ $guess_info_str;
		}
		if (/[BCDE]/.test(rank))	///@debug B勝利以下のみ記録する.
			push_to_logbook($next_enemy + ', ' + $guess_info_str);
		var fleet = $enemy_list[$enemy_id];
		if (fleet) {
			fleet[0] = e_name +'('+ e_fmat +')';
			update_enemy_list();
		}
		var log = $next_enemy +'('+ e_name +'):'+ rank;
		if (drop_ship_name) {
			log += '+' + g.api_ship_name; // drop_ship_name; 艦種を付けると冗長すぎるので艦名のみとする.
		}
		if (drop_item_name) {
			log += '+' + drop_item_name;
		}
		$battle_log.push(log);
		$last_mission[$battle_deck_id] = '前回出撃：'+ $battle_log.join(' →');
	}
	if (mvp) {
		var id = $fdeck_list[$battle_deck_id].api_ship[mvp-1];
		var ship = $ship_list[id];
		msg += '<br />MVP：'+ ship.name_lv() +' +'+ d.api_get_ship_exp[mvp] +'exp';
	}
	if (mvp_c) {
		var id = $fdeck_list[2].api_ship[mvp_c-1];
		var ship = $ship_list[id];
		msg += '<br />MVP：'+ ship.name_lv() +' +'+ d.api_get_ship_exp_combined[mvp_c] +'exp';
	}
	if (lost) {
		for (var i in lost) {
			if (lost[i] == 1) {
				var id = $fdeck_list[$battle_deck_id].api_ship[i-1];
				var ship = $ship_list[id];
				msg += '<br />LOST：'+ ship.name_lv();
				ship_delete([id]);
			}
		}
	}
	if (drop_ship_name) {
		msg += '<br />'+ tp[3] +'drop ship'+ tp[4] + drop_ship_name;
	}
	if (drop_item_name) {
		msg += '<br />'+ tp[3] +'drop item'+ tp[4] + drop_item_name;
	}
	dpnla.tmpviw(1,'c43',msg);
}

function calc_damage(hp, battle, hc) {
	// hp ::= [-1, friend1...6, enemy1...6]
	// hc ::= [-1, combined1..6]
	if (!battle) return;
	if (battle.api_df_list && battle.api_damage) {
		var df = battle.api_df_list;
		for (var i = 1; i < df.length; ++i) {
			for (var j = 0; j < df[i].length; ++j) {
				var target = df[i][j];
				if (hc && target <= 6)
					hc[target] -= Math.floor(battle.api_damage[i][j]);
				else
					hp[target] -= Math.floor(battle.api_damage[i][j]);
			}
		}
	}
	if (battle.api_fdam) {
		for (var i = 1; i <= 6; ++i) {
			if (hc)
				hc[i] -= Math.floor(battle.api_fdam[i]);
			else
				hp[i] -= Math.floor(battle.api_fdam[i]);
		}
	}
	if (battle.api_edam) {
		for (var i = 1; i <= 6; ++i) {
			hp[i+6] -= Math.floor(battle.api_edam[i]);
		}
	}
	if (battle.api_deck_id && battle.api_damage) { // battle: api_support_hourai
		for (var i = 1; i <= 6; ++i) {
			hp[i+6] -= Math.floor(battle.api_damage[i]);
		}
	}
}

function calc_kouku_damage(airplane, hp, kouku, hc) {
	if (!kouku) return;
	if (kouku.api_stage1) {	// 制空戦.
		airplane.seiku = kouku.api_stage1.api_disp_seiku;
		airplane.touch = kouku.api_stage1.api_touch_plane;
		airplane.f_lostcount += kouku.api_stage1.api_f_lostcount;
	}
	if (kouku.api_stage2) {	// 防空戦.
		airplane.f_lostcount += kouku.api_stage2.api_f_lostcount;
		if (kouku.api_stage2.api_air_fire) {
			airplane.air_fire = kouku.api_stage2.api_air_fire;
		}
	}
	calc_damage(hp, kouku.api_stage3);				// 航空爆撃雷撃戦.
	calc_damage(hp, kouku.api_stage3_combined, hc);	// 連合第二艦隊：航空爆撃雷撃戦.
}

function push_fdeck_status(ptn, fdeck, maxhps, nowhps, beginhps, airpl) {
	var tp = dpnla.tmpget('tp4_1');		var ha = '';
	var ra = ['','','','','',''];
	for (var i = 1; i <= 6; ++i) {
		var maxhp = maxhps[i];
		if (maxhp == -1) continue;
		var nowhp = nowhps[i];	var name = '?';		var shlv = '?';
		var ship = $ship_list[fdeck.api_ship[i-1]];
		if (ship) {
			name = ship_name(ship.ship_id);		shlv = ship.lv;
			if (nowhp <= 0 && slotitem_use(ship.slot, [42, 43])) name += tp[6];
			var repair = slotitem_count(ship.slot, 42);	// 修理要員(ダメコン).
			var megami = slotitem_count(ship.slot, 43);	// 修理女神.
			if (repair) name += tp[7] +'修理要員x'+ repair + tp[8];
			if (megami) name += tp[7] +'修理女神x'+ megami + tp[8];
		}
		ra[0] = i;	ra[1] = name;		ra[2] = shlv;
		ra[3] = (nowhp < 0 ? 0 : nowhp) +'/'+ maxhp;
		ra[4] = diff_name(nowhp, beginhps[i]);	ra[5] = damage_name(nowhp, maxhp);
		ha += dpnla.tmprep(2,ra,tp[1]);
	}
	ra[0] = fdeck.api_name;		ra[1] = '&nbsp;';		ra[2] = 'c'+ (47 + ptn);
	if(airpl != '') ra[1] = airpl;
	ha = tp[0] + ha + tp[2];
	dpnla.tmpviw(ptn,'c44',dpnla.tmprep(2,ra,ha));
}

function guess_win_rank(nowhps, maxhps, beginhps, nowhps_c, maxhps_c, beginhps_c, isChase) {
	// 友軍の轟沈／護衛退避には未対応.
	// 応急修理発動時の計算も不明.
	var f_damage_total = 0;
	var f_hp_total = 0;
	var f_maxhp_total = 0;
	var f_lost_count = 0;
	var f_count = 0;
	var e_damage_total = 0;
	var e_hp_total = 0;
	var e_count = 0;
	var e_lost_count = 0;
	var e_leader_lost = false;
	for (var i = 1; i <= 6; ++i) {
		// 友軍被害集計.
		if(maxhps[i] == -1) continue;
		var n = nowhps[i];
		++f_count;
		f_damage_total += beginhps[i] - Math.max(0, n);
		f_hp_total += beginhps[i];
		f_maxhp_total += maxhps[i];
		if (n <= 0) {
			++f_lost_count;
		}
	}
	for (var i = 1; i <= 6; ++i) {
		// 連合第二友軍被害集計.
		if(!maxhps_c || maxhps_c[i] == -1) continue;
		var n = nowhps_c[i];
		++f_count;
		f_damage_total += beginhps_c[i] - Math.max(0, n);
		f_hp_total += beginhps_c[i];
		f_maxhp_total += maxhps_c[i];
		if (n <= 0) {
			++f_lost_count;
		}
	}
	for(var i = 7; i <= 12; ++i){
		// 敵艦被害集計.
		if(maxhps[i] == -1) continue;
		var n = nowhps[i];
		++e_count;
		e_damage_total += beginhps[i] - Math.max(0, n);
		e_hp_total += beginhps[i];
		if (n <= 0) {
			++e_lost_count;
			if(i == 7) e_leader_lost = true;
		}
	}
	$f_damage = f_damage_total;
	// %%% CUT HERE FOR TEST %%%
	var f_damage_percent = 100 * f_damage_total / f_hp_total;
	var e_damage_percent = 100 * e_damage_total / e_hp_total;
	f_damage_percent = Math.floor(f_damage_percent); // 少数部を切り捨てる.
	e_damage_percent = Math.floor(e_damage_percent); // 少数部を切り捨てる. 
	var rate = e_damage_total == 0 ? 0   : // 潜水艦お見合い等ではDになるので敵ダメ判定を優先する(f_damage_total==0でも100にしない)
			   f_damage_total == 0 ? 100 : // こちらが無傷なら1ダメ以上与えていればBなのでrateを100にする.
			   e_damage_percent / (f_damage_percent == 0 ? 1 : f_damage_percent); // 0除算回避. 要検証!!! 敵味方とも1%未満の微ダメージのときの処理が曖昧.
//	rate = Math.ceil(rate * 10) / 10; // 小数部2桁目を切り上げる.
	$guess_info_str = 'f_damage:' + fraction_percent_name(f_damage_total, f_hp_total) + '[' + f_lost_count + '/' + f_count + ']' + f_maxhp_total
				+ ', e_damage:' + fraction_percent_name(e_damage_total, e_hp_total) + (e_leader_lost ? '[x' : '[') + e_lost_count + '/' + e_count + ']'
				+ (isChase ? ', chase_rate:' : ', rate:') + Math.round(rate * 10000) / 10000
				;
	if (e_count == e_lost_count && f_lost_count == 0) {
		return (f_damage_total == 0) ? '完S' : 'S';
	}
	if (e_lost_count >= (e_count == 6 ? 4 : e_count/2) && f_lost_count == 0) {
		return 'A';
	}
	if (e_leader_lost && f_lost_count < e_lost_count) {
		return 'B';
	}
	if (rate > 2.5) { // ほぼ確定. rate == 2.5 でC判定を確認済み.
		return 'B';
	}
	if (rate > 0.9) { // 要検証!!! r == 0.958 でC判定を確認. rate == 0.8169 でD判定を確認済み. 0.817～0.957 の区間に閾値がある. 
		return 'C';
	}
	if (f_lost_count < f_count/2) { // 要検証.
		return 'D';
	}
	return 'E';
}

function on_battle(json) {
	var d = json.api_data;
	if (!d.api_maxhps || !d.api_nowhps) return;
	var maxhps = d.api_maxhps;				// 出撃艦隊[1..6] 敵艦隊[7..12]
	var nowhps = d.api_nowhps;				// 出撃艦隊[1..6] 敵艦隊[7..12]
	var maxhps_c = d.api_maxhps_combined;	// 連合第二艦隊[1..6].
	var nowhps_c = d.api_nowhps_combined;	// 連合第二艦隊[1..6].
	var beginhps = nowhps.concat();
	var beginhps_c = nowhps_c ? nowhps_c.concat() : [];
	var airplane = {
		seiku : null, 				// 制空権.
		touch : d.api_touch_plane,	// 触接. 夜戦はd.にある、昼戦はd.api_kouku.state1.にある.
		f_lostcount : 0,			// 非撃墜数.
		air_fire : null				// 対空カットイン.
	};
	calc_kouku_damage(airplane, nowhps, d.api_kouku, nowhps_c); // 航空戦.
	calc_kouku_damage(airplane, nowhps, d.api_kouku2, nowhps_c); // 航空戦第二波.
	calc_damage(nowhps, d.api_opening_atack, nowhps_c);	// 開幕雷撃.
	calc_damage(nowhps, d.api_hougeki, nowhps_c);	// midnight
	switch ($combined_flag) {
	default:// 不明.
	case 0: // 通常艦隊.
		calc_damage(nowhps, d.api_hougeki1);	// 第一艦隊砲撃一巡目.
		calc_damage(nowhps, d.api_hougeki2);	// 第一艦隊砲撃二巡目.
		break;
	case 1: // 連合艦隊(機動部隊).
		calc_damage(nowhps, d.api_hougeki1, nowhps_c);	// 第二艦隊砲撃.
		calc_damage(nowhps, d.api_hougeki2);	// 第一艦隊砲撃一巡目.
		calc_damage(nowhps, d.api_hougeki3);	// 第一艦隊砲撃二巡目.
		break;
	case 2: // 連合艦隊(水上部隊).
		calc_damage(nowhps, d.api_hougeki1);	// 第一艦隊砲撃一巡目.
		calc_damage(nowhps, d.api_hougeki2);	// 第一艦隊砲撃二順目.
		calc_damage(nowhps, d.api_hougeki3, nowhps_c);	// 第二艦隊砲撃.
		break;
	}
	calc_damage(nowhps, d.api_raigeki, nowhps_c);
	if (d.api_support_flag == 1) calc_damage(nowhps, d.api_support_info.api_support_airattack.api_stage3); // 1:航空支援.
	if (d.api_support_flag == 2) calc_damage(nowhps, d.api_support_info.api_support_hourai); // 2:支援射撃
	if (d.api_support_flag == 3) calc_damage(nowhps, d.api_support_info.api_support_hourai); // 3:支援長距離雷撃.
	if (!d.api_deck_id) d.api_deck_id = d.api_dock_id; // battleのデータは、綴りミスがあるので補正する.
	var fdeck = $fdeck_list[d.api_deck_id];
	$battle_deck_id = fdeck.api_id;
	var fmt = null;
	if (d.api_formation) {
		$enemy_formation_id = d.api_formation[1];
		fmt = formation_name(d.api_formation[0]) + ' / '
			+ match_name(d.api_formation[2]) + ' / '
			+ formation_name(d.api_formation[1]);
		if (d.api_support_flag) fmt += ' + ' + support_name(d.api_support_flag);
	}
	var req = [];
	dpnla.tmpviw(0,'c42',($next_mapinfo ? $next_mapinfo.api_name : '') +' battle'+ $battle_count);
	req.push($next_enemy);
	if (fmt) req.push(fmt);
	if (d.api_search) {
		req.push('索敵：' + search_name(d.api_search[0])); // d.api_search[1] は敵索敵か??
	}
	if (airplane.touch) {
		var t0 = airplane.touch[0]; if (t0 != -1) req.push('触接中：' + slotitem_name(t0));
		var t1 = airplane.touch[1]; if (t1 != -1) req.push('被触接中：' + slotitem_name(t1));
	}
	if (airplane.seiku != null) req.push(seiku_name(airplane.seiku));
	if (airplane.air_fire != null) {
		var air_fire = airplane.air_fire;
		var idx = air_fire.api_idx;
		var api_ship = 0;
		if ($combined_flag && idx >= 6) {
			api_ship = $fdeck_list[2].api_ship[idx - 6]; // 連合第二艦隊決め打ち
		} else {
			api_ship = fdeck.api_ship[idx];
		}
		var ship = $ship_list[api_ship];
		req.push('対空カットイン(' + air_fire.api_kind + ')：' + ship.name_lv() + ' 【' + slotitem_names(air_fire.api_use_items) + '】');
	}

	if ($beginhps) req.push('緒戦被害：'+ $guess_info_str + '，推定：'+ $guess_win_rank);
	if (!$beginhps) $beginhps = beginhps;
	if (!$beginhps_c) $beginhps_c = beginhps_c;
	if (d.api_escape_idx) {
		d.api_escape_idx.forEach(function(idx) {
			maxhps[idx] = -1;	// 護衛退避した艦を艦隊リストから抜く. idx=1..6
		});
	}
	if (d.api_escape_idx_combined) {
		d.api_escape_idx_combined.forEach(function(idx) {
			maxhps_c[idx] = -1;	// 護衛退避した艦を第二艦隊リストから抜く. idx=1..6
		});
	}
	$guess_win_rank = guess_win_rank(nowhps, maxhps, $beginhps, nowhps_c, maxhps_c, $beginhps_c, $beginhps != beginhps);
	req.push('戦闘被害：'+ $guess_info_str);
	req.push('勝敗推定：'+ $guess_win_rank);
	
	
	push_fdeck_status(0, fdeck, maxhps, nowhps, beginhps,'被撃墜数：'+ airplane.f_lostcount);
	
	if (nowhps_c) {
		
		push_fdeck_status(1, $fdeck_list[2], maxhps_c, nowhps_c, beginhps_c, ''); // 連合第二艦隊は二番固定です.
	}
	var tp = dpnla.tmpget('tp4_1');		var ra = ['','','','','',''];		var ha = '';
	var enemy_fleet = [$enemy_list[$enemy_id] ? $enemy_list[$enemy_id][0] : '???'];
	for (var i = 1; i <= 6; ++i) {
		var ke = d.api_ship_ke[i];
		if (ke == -1) continue;
		var nowhp = nowhps[i+6];	var maxhp = maxhps[i+6];
		ra[0] = i;	ra[1] = ship_name(ke);	ra[2] = d.api_ship_lv[i];
		ra[3] = (nowhp < 0 ? 0 : nowhp) +'/'+ maxhp;	ra[4] = diff_name(nowhp, beginhps[i+6]);
		ra[5] = damage_name(nowhp, maxhp);	ha += dpnla.tmprep(2,ra,tp[1]);
		var name = ra[1] +'Lv'+ ra[2];	enemy_fleet.push(name);
	}
	ra[0] = enemy_fleet[0];		ra[1] = '&nbsp;';		ra[2] = 'c46';
	ha = tp[0] + ha + tp[2];
	dpnla.tmpviw(0,'c45',dpnla.tmprep(2,ra,ha));
	if ($enemy_id) { // 演習は$enemy_idが空
		$enemy_list[$enemy_id] = enemy_fleet;
		update_enemy_list();
	}
	dpnla.tmpviw(0,'c43',req.join('<br />') +'<br />');
}

chrome.devtools.network.onRequestFinished.addListener(function (request) {
	var func = null;
	var api_name = request.request.url.replace(/^http:\/\/[^\/]+\/kcsapi\//, '/');
	if (api_name == request.request.url) {
		// 置換失敗. api以外なので早抜けする.
		return;
	}
	else if (api_name == '/api_start2') {
		// ゲーム開始時点.
		func = function(json) { // 艦種表を取り込む.
			update_mst_ship(json.api_data.api_mst_ship);
			update_mst_slotitem(json.api_data.api_mst_slotitem);
			update_mst_useitem(json.api_data.api_mst_useitem);
			update_mst_mission(json.api_data.api_mst_mission);
			update_mst_mapinfo(json.api_data.api_mst_mapinfo);
			var tp = dpnla.tmpget('tp1_2');
			var ht = dpnla.tmprep(0,' ゲーム情報の取得に成功しました',tp[0]);
			dpnla.tmpviw(0,'t01_1',ht);
		};
	}
	else if (api_name == '/api_get_member/slot_item') {
		// 保有装備一覧表.
		func = function(json) { // 保有する装備配列をリストに記録する.
			$slotitem_list = {};
			add_slotitem_list(json.api_data);
		};
	}
	else if (api_name == '/api_get_member/kdock') {
		// 建造一覧表(ログイン直後、建造直後).
		func = function(json) { // 建造状況を更新する.
			update_kdock_list(json.api_data);
		};
	}
	else if (api_name == '/api_req_kousyou/createitem') {
		// 装備開発.
		func = function(json) { // 開発した装備を、リストに加える.
			if (json.api_data.api_create_flag) {
				add_slotitem_list(json.api_data.api_slot_item);
				on_port(json);
			}
		};
	}
	else if (api_name == '/api_req_kousyou/getship') {
		// 新艦建造成功.
		func = function(json) { // 建造艦が持つ初期装備配列を、リストに加える.
			update_kdock_list(json.api_data.api_kdock);
			update_ship_list([json.api_data.api_ship], false);
			add_slotitem_list(json.api_data.api_slotitem);
			on_port(json);
		};
	}
	else if (api_name == '/api_req_kousyou/destroyitem2') {
		// 装備破棄.
		func = function(json) { // 破棄した装備を、リストから抜く.
			var ids = decode_postdata_params(request.request.postData.params).api_slotitem_ids;
			if (ids) slotitem_delete(ids.split('%2C'));
			on_port(json);
		};
	}
	else if (api_name == '/api_req_kousyou/destroyship') {
		// 艦娘解体.
		func = function(json) { // 解体した艦娘が持つ装備を、リストから抜く.
			var id = decode_postdata_params(request.request.postData.params).api_ship_id;
			if (id) ship_delete([id]);
			on_port(json);
		};
	}
	else if (api_name == '/api_req_kaisou/powerup') {
		// 近代化改修.
		func = function(json) { // 素材として使った艦娘が持つ装備を、リストから抜く.
			var ids = decode_postdata_params(request.request.postData.params).api_id_items;
			if (ids) ship_delete(ids.split('%2C'));
			on_port(json);
		};
	}
	else if (api_name == '/api_req_kousyou/remodel_slot') {
		// 装備改修.
		func = function(json) {	// 明石の改修工廠で改修した装備をリストに反映する.
			add_slotitem_list(json.api_data.api_after_slot);	// 装備リストを更新する.
			slotitem_delete(json.api_data.api_use_slot_id);		// 改修で消費した装備を装備リストから抜く.
			on_port(json);
		};
	}
	else if (api_name == '/api_req_kaisou/lock') {
		// 装備ロック.
		func = function(json) {
			var id = decode_postdata_params(request.request.postData.params).api_slotitem_id;	// ロック変更した装備ID.
			$slotitem_list[id].locked = json.api_data.api_locked;
			on_port(json);
		};
	}
	else if (api_name == '/api_req_hensei/change') {
		// 艦隊編成.
		var params = decode_postdata_params(request.request.postData.params);
		var list = $fdeck_list[params.api_id].api_ship;	// 変更艦隊リスト.
		var id  = parseInt(params.api_ship_id, 10);		// -2:一括解除, -1:解除, 他:艦娘ID.
		var idx = parseInt(params.api_ship_idx, 10);	// -1:一括解除, 0..N:変更位置.
		if (id == -2) {
			// 旗艦以外の艦を外す(-1を設定する).
			for (var i = 1; i < list.length; ++i) list[i] = -1;
		}
		else if (id == -1) {
			// 外す.
			list.splice(idx, 1);
			list.push(-1);
		}
		else { // id = 0..N
			find: for (var f_id in $fdeck_list) {
				// 艦娘IDの元の所属位置を old_list[old_idx] に得る.
				var old_list = $fdeck_list[f_id].api_ship;
				for (var old_idx = 0; old_idx < old_list.length; ++old_idx) {
					if (old_list[old_idx] == id) break find;
				}
			}
			if (old_list[old_idx] == id) {
				// 位置交換.
				old_list[old_idx] = list[idx];
				list[idx] = id;
				// 元位置が空席になったら前詰めする.
				if (old_list[old_idx] == -1) {
					old_list.splice(old_idx, 1);
					old_list.push(-1);
				}
			}
			else {
				// 新規追加.
				list[idx] = id;
			}
		}
		var dummy_json = { api_data: {} }; // 艦隊編成パケットは api_data を持たないので、母港表示にダミーパケットを渡す.
		on_port(dummy_json);
	}
	else if (api_name == '/api_get_member/questlist') {
		// 任務一覧.
		func = function(json) { // 任務総数と任務リストを記録する.
			var list = json.api_data.api_list;
			if (!list) return;
			$quest_count = json.api_data.api_count;
			$quest_exec_count = json.api_data.api_exec_count;
			if (json.api_data.api_disp_page == 1 && $quest_count != Object.keys($quest_list).length) {
				$quest_list = {}; // 任務総数が変わったらリストをクリアする.
			}
			list.forEach(function(data) {
				if (data == -1) return; // 最終ページには埋草で-1 が入っているので除外する.
				$quest_list[data.api_no] = data;
				if (data.api_no == 214) {
					get_weekly().quest_state = data.api_state; // あ号任務ならば、遂行状態を記録する(1:未遂行, 2:遂行中, 3:達成)
				}
			});
			on_port(json);
		};
	}
	else if (api_name == '/api_get_member/ndock') {
		// 入渠.
		func = function(json) { // 入渠状況を更新する.
			update_ndock_list(json.api_data);
			on_mission_check(5);
		};
	}
	else if (api_name == '/api_port/port') {
		// 母港帰還.
		func = function(json) { // 保有艦、艦隊一覧を更新してcond表示する.
			update_ship_list(json.api_data.api_ship, true);
			update_fdeck_list(json.api_data.api_deck_port);
			update_ndock_list(json.api_data.api_ndock);
			$battle_deck_id = -1;
			$ship_escape = {};
			on_port(json);
		};
	}
	else if (api_name == '/api_get_member/ship2') {
		// 進撃.
		func = function(json) { // 保有艦、艦隊一覧を更新してcond表示する.
			update_ship_list(json.api_data, true);
			update_fdeck_list(json.api_data_deck);
			on_port(json);
		};
	}
	else if (api_name == '/api_get_member/ship3') {
		// 装備換装.
		func = function(json) { // 保有艦、艦隊一覧を更新してcond表示する.
			var is_all = true;
			if (decode_postdata_params(request.request.postData.params).api_shipid) {
				is_all = false; // 装備解除時は差分のみ.
			}
			update_ship_list(json.api_data.api_ship_data, is_all);
			update_fdeck_list(json.api_data.api_deck_data);
			on_port(json);
		};
	}
	else if (api_name == '/api_get_member/mission') {
		// 遠征メニュー.
		func = function(json) { // 遠征任務の受諾をチェックする.
			on_mission_check(4);
		};
	}
	else if (api_name == '/api_get_member/deck') {
		// 遠征出発.
		func = function(json) { // 艦隊一覧を更新してcond表示する.
			update_fdeck_list(json.api_data);
			on_port(json);
		};
	}
	else if (api_name == '/api_req_mission/result') {
		// 遠征結果.
		func = function(json) { // 成功状況を記録する.
			var d = json.api_data;
			var id = decode_postdata_params(request.request.postData.params).api_deck_id;
			$last_mission[id] = '前回遠征：' + d.api_quest_name + ' ' + mission_clear_name(d.api_clear_result);
		};
	}
	else if (api_name == '/api_get_member/practice') {
		// 演習メニュー.
		func = function(json) { // 演習任務の受諾をチェックする.
			on_mission_check(3);
		};
	}
	else if (api_name == '/api_req_member/get_practice_enemyinfo') {
		// 演習相手の情報.
		func = function(json) { // 演習相手の提督名を記憶する.
			$next_enemy = "演習相手："+ json.api_data.api_nickname;
			$next_mapinfo = { api_name : "演習" };
			$enemy_id = null;
		};
	}
	else if (api_name == '/api_req_map/start') {
		// 海域初回選択.
		$battle_count = 0;
		$battle_log = [];		dpnla.tab14init('出撃');
		var w = get_weekly();
		if (w.quest_state == 2) w.sortie++;
		$is_boss = false;
		func = on_next_cell;
	}
	else if (api_name == '/api_req_map/next') {
		// 海域次選択.
		func = on_next_cell;
	}
	else if (api_name == '/api_req_sortie/battle'
		|| api_name == '/api_req_sortie/airbattle'
		|| api_name == '/api_req_combined_battle/battle'
		|| api_name == '/api_req_combined_battle/battle_water'
		|| api_name == '/api_req_combined_battle/airbattle') {
		// 昼戦開始.
		$battle_count++;
		$beginhps = null;
		$beginhps_c = null;
		func = on_battle;
	}
	else if (api_name == '/api_req_battle_midnight/battle'
		|| api_name == '/api_req_combined_battle/midnight_battle') {
		// 昼戦→夜戦追撃.
		func = on_battle;
	}
	else if (api_name == '/api_req_battle_midnight/sp_midnight'
		|| api_name == '/api_req_combined_battle/sp_midnight') {
		// 夜戦開始.
		$battle_count++;
		$beginhps = null;
		$beginhps_c = null;
		func = on_battle;
	}
	else if (api_name == '/api_req_sortie/night_to_day') {
		// 夜戦→昼戦追撃.
		func = on_battle;
	}
	else if (api_name == '/api_req_practice/battle') {
		// 演習開始.
		$battle_count = 1;
		$beginhps = null;
		$beginhps_c = null;
		$battle_log = [];		dpnla.tab14init('演習');
		func = on_battle;
	}
	else if (api_name == '/api_req_practice/midnight_battle') {
		// 夜演習継続.
		func = on_battle;
	}
	else if (api_name == '/api_req_sortie/battleresult'
		|| api_name == '/api_req_combined_battle/battleresult') {
		// 戦闘結果.
		func = function(json) {
			on_battle_result(json);
			var r = json.api_data.api_win_rank;
			var w = get_weekly();
			if (w.quest_state != 2) return; // 遂行中以外は更新しない.
			if (r == 'S') w.win_S++;
			if($is_boss) {
				w.boss_cell++;
				if (r == 'S' || r == 'A' || r == 'B') w.win_boss++;
			}
			save_weekly();
		};
	}
	else if (api_name == '/api_req_practice/battle_result') {
		// 演習結果.
		func = on_battle_result;
	}
	else if (api_name == '/api_req_combined_battle/goback_port') {
		// 護衛退避.
		on_goback_port();
	}
	if (!func) return;
	request.getContent(function (content) {
		if (!content) return;
		var json = JSON.parse(content.replace(/^svdata=/, ''));
		if (!json || !json.api_data) return;
		func(json);
	});
});
