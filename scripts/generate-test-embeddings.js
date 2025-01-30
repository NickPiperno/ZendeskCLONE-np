"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __generator = (this && this.__generator) || function (thisArg, body) {
    var _ = { label: 0, sent: function() { if (t[0] & 1) throw t[1]; return t[1]; }, trys: [], ops: [] }, f, y, t, g = Object.create((typeof Iterator === "function" ? Iterator : Object).prototype);
    return g.next = verb(0), g["throw"] = verb(1), g["return"] = verb(2), typeof Symbol === "function" && (g[Symbol.iterator] = function() { return this; }), g;
    function verb(n) { return function (v) { return step([n, v]); }; }
    function step(op) {
        if (f) throw new TypeError("Generator is already executing.");
        while (g && (g = 0, op[0] && (_ = 0)), _) try {
            if (f = 1, y && (t = op[0] & 2 ? y["return"] : op[0] ? y["throw"] || ((t = y["return"]) && t.call(y), 0) : y.next) && !(t = t.call(y, op[1])).done) return t;
            if (y = 0, t) op = [op[0] & 2, t.value];
            switch (op[0]) {
                case 0: case 1: t = op; break;
                case 4: _.label++; return { value: op[1], done: false };
                case 5: _.label++; y = op[1]; op = [0]; continue;
                case 7: op = _.ops.pop(); _.trys.pop(); continue;
                default:
                    if (!(t = _.trys, t = t.length > 0 && t[t.length - 1]) && (op[0] === 6 || op[0] === 2)) { _ = 0; continue; }
                    if (op[0] === 3 && (!t || (op[1] > t[0] && op[1] < t[3]))) { _.label = op[1]; break; }
                    if (op[0] === 6 && _.label < t[1]) { _.label = t[1]; t = op; break; }
                    if (t && _.label < t[2]) { _.label = t[2]; _.ops.push(op); break; }
                    if (t[2]) _.ops.pop();
                    _.trys.pop(); continue;
            }
            op = body.call(thisArg, _);
        } catch (e) { op = [6, e]; y = 0; } finally { f = t = 0; }
        if (op[0] & 5) throw op[1]; return { value: op[0] ? op[1] : void 0, done: true };
    }
};
Object.defineProperty(exports, "__esModule", { value: true });
var supabase_js_1 = require("@supabase/supabase-js");
var openai_1 = require("@langchain/openai");
var dotenv_1 = require("dotenv");
var path_1 = require("path");
// Load environment variables
var envPath = (0, path_1.resolve)(process.cwd(), '.env');
(0, dotenv_1.config)({ path: envPath });
if (!process.env.VITE_SUPABASE_URL || !process.env.SUPABASE_SERVICE_KEY || !process.env.VITE_OPENAI_API_KEY) {
    console.error('Missing required environment variables');
    process.exit(1);
}
// Initialize Supabase client
var client = (0, supabase_js_1.createClient)(process.env.VITE_SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY, {
    auth: {
        autoRefreshToken: false,
        persistSession: false
    }
});
// Initialize OpenAI embeddings
var embeddings = new openai_1.OpenAIEmbeddings();
function deleteExistingEmbeddings() {
    return __awaiter(this, void 0, void 0, function () {
        var error;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    console.log('Deleting existing embeddings...');
                    return [4 /*yield*/, client
                            .from('ai_documents')
                            .delete()
                            .neq('id', '00000000-0000-0000-0000-000000000000')];
                case 1:
                    error = (_a.sent()).error;
                    if (error) {
                        console.error('Error deleting existing embeddings:', error);
                    }
                    else {
                        console.log('Successfully deleted existing embeddings');
                    }
                    return [2 /*return*/];
            }
        });
    });
}
function generateEmbeddings() {
    return __awaiter(this, void 0, void 0, function () {
        var _a, articles, articlesError, _i, _b, article, embedding, error, _c, tickets, ticketsError, _d, _e, ticket, embedding, error, _f, teams, teamsError, _g, _h, team, members, memberInfo, fullContent, embedding, error, error_1;
        return __generator(this, function (_j) {
            switch (_j.label) {
                case 0:
                    console.log('Starting test data embedding generation...');
                    _j.label = 1;
                case 1:
                    _j.trys.push([1, 25, , 26]);
                    // Delete existing embeddings first
                    return [4 /*yield*/, deleteExistingEmbeddings()];
                case 2:
                    // Delete existing embeddings first
                    _j.sent();
                    // Process KB Articles
                    console.log('\nProcessing KB Articles...');
                    return [4 /*yield*/, client
                            .from('kb_articles')
                            .select('id, title, content')
                            .eq('deleted', false)];
                case 3:
                    _a = _j.sent(), articles = _a.data, articlesError = _a.error;
                    if (!articlesError) return [3 /*break*/, 4];
                    console.error('Error fetching KB articles:', articlesError);
                    return [3 /*break*/, 9];
                case 4:
                    _i = 0, _b = articles || [];
                    _j.label = 5;
                case 5:
                    if (!(_i < _b.length)) return [3 /*break*/, 9];
                    article = _b[_i];
                    return [4 /*yield*/, embeddings.embedQuery(article.content)];
                case 6:
                    embedding = _j.sent();
                    return [4 /*yield*/, client
                            .from('ai_documents')
                            .upsert({
                            content: article.content,
                            metadata: {
                                title: article.title,
                                document_type: 'kb_article'
                            },
                            embedding: embedding,
                            document_type: 'kb_article',
                            reference_id: article.id,
                            title: article.title
                        })];
                case 7:
                    error = (_j.sent()).error;
                    if (error) {
                        console.error("Error storing KB article embedding (".concat(article.id, "):"), error);
                    }
                    else {
                        console.log("Generated embedding for KB article: ".concat(article.title));
                    }
                    _j.label = 8;
                case 8:
                    _i++;
                    return [3 /*break*/, 5];
                case 9:
                    // Process Tickets
                    console.log('\nProcessing Tickets...');
                    return [4 /*yield*/, client
                            .from('tickets')
                            .select('id, title, description, status, priority')
                            .eq('deleted', false)];
                case 10:
                    _c = _j.sent(), tickets = _c.data, ticketsError = _c.error;
                    if (!ticketsError) return [3 /*break*/, 11];
                    console.error('Error fetching tickets:', ticketsError);
                    return [3 /*break*/, 16];
                case 11:
                    _d = 0, _e = tickets || [];
                    _j.label = 12;
                case 12:
                    if (!(_d < _e.length)) return [3 /*break*/, 16];
                    ticket = _e[_d];
                    return [4 /*yield*/, embeddings.embedQuery(ticket.description || '')];
                case 13:
                    embedding = _j.sent();
                    return [4 /*yield*/, client
                            .from('ai_documents')
                            .upsert({
                            content: ticket.description || '',
                            metadata: {
                                status: ticket.status,
                                priority: ticket.priority,
                                document_type: 'ticket'
                            },
                            embedding: embedding,
                            document_type: 'ticket',
                            reference_id: ticket.id,
                            title: ticket.title
                        })];
                case 14:
                    error = (_j.sent()).error;
                    if (error) {
                        console.error("Error storing ticket embedding (".concat(ticket.id, "):"), error);
                    }
                    else {
                        console.log("Generated embedding for ticket: ".concat(ticket.title));
                    }
                    _j.label = 15;
                case 15:
                    _d++;
                    return [3 /*break*/, 12];
                case 16:
                    // Process Teams
                    console.log('\nProcessing Teams...');
                    return [4 /*yield*/, client
                            .from('teams')
                            .select('id, name, description')
                            .eq('deleted', false)];
                case 17:
                    _f = _j.sent(), teams = _f.data, teamsError = _f.error;
                    if (!teamsError) return [3 /*break*/, 18];
                    console.error('Error fetching teams:', teamsError);
                    return [3 /*break*/, 24];
                case 18:
                    _g = 0, _h = teams || [];
                    _j.label = 19;
                case 19:
                    if (!(_g < _h.length)) return [3 /*break*/, 24];
                    team = _h[_g];
                    return [4 /*yield*/, client
                            .from('team_members')
                            .select("\n                        user_id,\n                        is_team_lead,\n                        profiles (\n                            full_name,\n                            email\n                        ),\n                        user_skills (\n                            proficiency_level,\n                            skills (\n                                name,\n                                category\n                            )\n                        )\n                    ")
                            .eq('team_id', team.id)];
                case 20:
                    members = (_j.sent()).data;
                    memberInfo = (members === null || members === void 0 ? void 0 : members.map(function (member) {
                        var _a;
                        var skills = ((_a = member.user_skills) === null || _a === void 0 ? void 0 : _a.map(function (us) {
                            return "".concat(us.skills.name, " (").concat(us.proficiency_level, ")");
                        }).join(', ')) || 'No specific skills listed';
                        return "".concat(member.is_team_lead ? 'Team Lead' : 'Member', ": ").concat(member.profiles.full_name, "\nSkills: ").concat(skills);
                    }).join('\n')) || 'No team members listed';
                    fullContent = "".concat(team.description || '', "\n                \nTeam Members:\n").concat(memberInfo);
                    return [4 /*yield*/, embeddings.embedQuery(fullContent)];
                case 21:
                    embedding = _j.sent();
                    return [4 /*yield*/, client
                            .from('ai_documents')
                            .upsert({
                            content: fullContent,
                            metadata: {
                                name: team.name,
                                document_type: 'team'
                            },
                            embedding: embedding,
                            document_type: 'team',
                            reference_id: team.id,
                            title: team.name
                        })];
                case 22:
                    error = (_j.sent()).error;
                    if (error) {
                        console.error("Error storing team embedding (".concat(team.id, "):"), error);
                    }
                    else {
                        console.log("Generated embedding for team: ".concat(team.name));
                    }
                    _j.label = 23;
                case 23:
                    _g++;
                    return [3 /*break*/, 19];
                case 24:
                    console.log('\nEmbedding generation completed');
                    return [3 /*break*/, 26];
                case 25:
                    error_1 = _j.sent();
                    console.error('Error during embedding generation:', error_1);
                    return [3 /*break*/, 26];
                case 26: return [2 /*return*/];
            }
        });
    });
}
generateEmbeddings().catch(console.error);
