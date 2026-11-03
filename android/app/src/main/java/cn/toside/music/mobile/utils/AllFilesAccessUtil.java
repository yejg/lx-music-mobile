package cn.toside.music.mobile.utils;

import android.app.Activity;
import android.content.Context;
import android.content.Intent;
import android.net.Uri;
import android.os.Build;
import android.os.Environment;
import android.provider.Settings;

/**
 * 所有文件访问权限（MANAGE_EXTERNAL_STORAGE）相关工具
 * 用于 Android 11(API 30) 及以上写入 Music 等非应用专属目录
 */
public class AllFilesAccessUtil {

  private AllFilesAccessUtil() {
  }

  /**
   * 该权限只存在于 Android 11(API 30) 及以上
   */
  public static boolean isSupported() {
    return Build.VERSION.SDK_INT >= Build.VERSION_CODES.R;
  }

  /**
   * 是否已拥有所有文件访问权限
   */
  public static boolean isGranted(Context context) {
    if (Build.VERSION.SDK_INT < Build.VERSION_CODES.R) {
      // Android 11 以下不受 Scoped Storage 限制，直接视为已授权
      return true;
    }
    return Environment.isExternalStorageManager();
  }

  /**
   * 打开系统的“所有文件访问权限”设置页
   * @return 是否成功打开设置页
   */
  public static boolean request(Activity activity, String packageName) {
    if (activity == null) return false;
    try {
      Intent intent = new Intent(Settings.ACTION_MANAGE_APP_ALL_FILES_ACCESS_PERMISSION);
      intent.setData(Uri.parse("package:" + packageName));
      intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
      activity.startActivity(intent);
      return true;
    } catch (Exception e) {
      // 部分机型没有该 Action 的包名页面，退回到总列表页
      try {
        Intent intent = new Intent(Settings.ACTION_MANAGE_ALL_FILES_ACCESS_PERMISSION);
        intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
        activity.startActivity(intent);
        return true;
      } catch (Exception e2) {
        return false;
      }
    }
  }
}
