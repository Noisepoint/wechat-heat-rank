// 测试API的简单脚本
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://fcilopdkqrknsninicdi.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZjaWxvcGRrcXJrbnNuaW5pY2RpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjI3Nzc4MTUsImV4cCI6MjA3ODM1MzgxNX0.VKVanUVupqLH7fxvjbuzSelmiMOCSOb5BL52Mpxh04k';

async function testDatabase() {
  console.log('🔍 测试数据库连接...');

  const supabase = createClient(supabaseUrl, supabaseKey);

  try {
    // 测试accounts表
    const { data: accounts, error: accountsError } = await supabase
      .from('accounts')
      .select('count')
      .limit(1);

    if (accountsError) {
      console.error('❌ Accounts表错误:', accountsError);
      return;
    }

    console.log('✅ Accounts表连接正常');

    // 测试settings表
    const { data: settings, error: settingsError } = await supabase
      .from('settings')
      .select('key, value')
      .limit(5);

    if (settingsError) {
      console.error('❌ Settings表错误:', settingsError);
      return;
    }

    console.log('✅ Settings表连接正常');
    console.log('📊 Settings数据:', settings);

    // 测试articles表（可能为空）
    const { data: articles, error: articlesError } = await supabase
      .from('articles')
      .select('id, title, pub_time')
      .limit(5);

    if (articlesError) {
      console.error('❌ Articles表错误:', articlesError);
      return;
    }

    console.log('✅ Articles表连接正常');
    console.log('📄 Articles数量:', articles.length);

    // 测试scores表
    const { data: scores, error: scoresError } = await supabase
      .from('scores')
      .select('article_id, time_window, proxy_heat')
      .limit(5);

    if (scoresError) {
      console.error('❌ Scores表错误:', scoresError);
      return;
    }

    console.log('✅ Scores表连接正常');
    console.log('📈 Scores数量:', scores.length);

    console.log('🎉 所有数据库连接测试通过！');

  } catch (error) {
    console.error('❌ 测试失败:', error);
  }
}

async function testEdgeFunction() {
  console.log('🌐 测试简化版Edge Function...');

  try {
    const response = await fetch('https://fcilopdkqrknsninicdi.supabase.co/functions/v1/articles-simple?window=7d&limit=3', {
      headers: {
        'Authorization': `Bearer ${supabaseKey}`,
        'Content-Type': 'application/json'
      }
    });

    const data = await response.json();

    if (response.ok) {
      console.log('✅ 简化版Edge Function响应正常');
      console.log('📦 返回数据:', data);
    } else {
      console.error('❌ 简化版Edge Function错误:', response.status, data);
    }

  } catch (error) {
    console.error('❌ 简化版Edge Function测试失败:', error);
  }
}

async function main() {
  console.log('🚀 开始API测试...\n');

  await testDatabase();
  console.log('\n');
  await testEdgeFunction();
}

main().catch(console.error);